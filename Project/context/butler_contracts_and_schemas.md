# 📜 DineFlow Butler: Contracts, Tool Catalog & Schema Specifications (Phase 1)

> **Document Version**: 1.0.0  
> **Status**: Phase 1 Delivery — Specifications & Contracts  
> **Scope**: Conversational protocol, tool schemas, safety contracts, model configuration, and service boundaries for the Butler AI Agent.

---

## 1. System Mapping & Context Resolution

Butler acts as an intent interpreter and conversational interface across two distinct personas: **Staff AI Restaurant Agent** and **Customer Personal Dining Agent**. All executions derive tenancy and authorization from verified server-side JWT claims—never from unauthenticated user input or LLM generation.

### 1.1. Identity & Context Model

| Identity Type | Token Source | Critical Claims | Permitted Scope |
|:---|:---|:---|:---|
| **Staff Member** | Auth Service Login | `sub: "u_<uuid>"`, `restaurantId: "<id>"`, `type: "STAFF"`, `roles: [...]`, `privileges: [...]` | Scoped strictly to authenticated `restaurantId`. Actions filtered by specific privileges (e.g. `MENU_CREATE`, `MENU_TOGGLE_AVAIL`, `ORDER_READ_ACTIVE`). |
| **Diner (Table Session)**| QR Scan `/table-session/init` | `sub: "guest"`, `restaurantId: "<id>"`, `tableId: "<uuid>"`, `tableSessionId: "<uuid>"`, `type: "CUSTOMER"`, `privileges: ["ORDER_CREATE"]` | Scoped strictly to active `restaurantId`, `tableId`, and `tableSessionId`. Can only browse active dishes, inspect ingredients, add to own session cart, and submit orders. |
| **Super Admin** | Auth Service Login | `sub: "u_<uuid>"`, `type: "STAFF"`, `roles: ["SUPER_ADMIN"]` | Global platform administration. Governs restaurant subscriptions and Butler feature entitlement. |

---

## 2. Model & Provider Configuration

Butler uses JavaScript with **LangChain.js**, **LangGraph.js**, and **Groq** as the high-throughput inference engine.

```ini
# Environment Variables (.env)
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_FALLBACK_MODEL=mixtral-8x7b-32768
GROQ_TEMPERATURE=0.1
GROQ_MAX_TOKENS=1024
GROQ_TIMEOUT_MS=8000
```

### 2.1. Model Selection & Fallback Policy
* **Primary Model**: `llama-3.3-70b-versatile` (Fast, highly accurate JSON schema tool calling and zero-shot reasoning).
* **Fallback Model**: `mixtral-8x7b-32768` (Resilient secondary fallback on provider 429/503).
* **Temperature**: `0.1` (Strict grounding; suppresses hallucinations on ingredients, prices, and quantities).
* **Timeout & Graceful Degradation**: 8-second request budget. If Groq times out or errors, the chat service falls back to safe structured responses without disrupting the normal application UI.

---

## 3. Chat Request & Response Protocol

The conversational endpoint is mounted at `POST /api/v1/chat` and routed through the gateway.

### 3.1. Request Contract

```typescript
export interface ButlerChatRequest {
  /** The natural language message entered by the user */
  message: string;

  /** Client-maintained conversation UUID for turn continuity */
  conversationId?: string;

  /** Explicit action confirmation for consequential mutations */
  confirmation?: {
    /** Target draft action ID generated in previous turn */
    actionId: string;
    /** User's explicit decision: true = execute mutation, false = discard draft */
    confirmed: boolean;
  };
}
```

### 3.2. Response Contract

```typescript
export interface ButlerChatResponse {
  success: boolean;
  conversationId: string;
  reply: string;
  role: "assistant";

  /** Present when Butler proposes a consequential mutation requiring explicit confirmation */
  draftAction?: {
    actionId: string;
    toolName: string;
    summary: string;
    payload: Record<string, unknown>;
    requiresConfirmation: true;
  };

  /** Trace of tools invoked to ground this response */
  toolCalls?: Array<{
    toolName: string;
    status: "EXECUTED" | "AWAITING_CONFIRMATION" | "FAILED";
    summary: string;
  }>;

  error?: {
    code: "AUTH_REQUIRED" | "FEATURE_NOT_ENTITLED" | "INSUFFICIENT_PRIVILEGES" | "CROSS_TENANT_FORBIDDEN" | "ACTION_EXPIRED" | "MODEL_UNAVAILABLE";
    message: string;
  };
}
```

---

## 4. Release-Scoped Tool Catalog Specification

Every tool is bound to a specific microservice and enforced by backend privilege checks.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   BUTLER TOOL CATALOG                                   │
├───────────────────────────────┬───────────────────────────────┬─────────────────────────┤
│ Read Tools (Immediate)       │ Mutating Tools (Confirmation) │ Dining Tools (Customer) │
├───────────────────────────────┼───────────────────────────────┼─────────────────────────┤
│ • get_user_profile            │ • create_menu_item            │ • search_menu           │
│ • get_menu_item               │ • disable_menu_item           │ • get_customer_catalog  │
│ • get_order                   │ • update_menu_item            │ • check_dietary_safety  │
│ • get_table_status            │                               │ • add_to_session_cart   │
│ • get_kitchen_status          │                               │                         │
└───────────────────────────────┴───────────────────────────────┴─────────────────────────┘
```

### Tool 1: `search_menu`
* **Owning Service**: `menu-service`
* **Classification**: Read (No confirmation required)
* **Target Personas**: Diner, Waiter, Staff
* **Required Privilege**: None for diners (scoped to available items); `MENU_READ` for staff
* **Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "query": { "type": "string", "description": "Keyword to match against dish title or description" },
    "categoryId": { "type": "string", "description": "Optional category filter" },
    "minPrice": { "type": "number", "description": "Minimum base price in INR" },
    "maxPrice": { "type": "number", "description": "Maximum base price in INR" },
    "dietaryTags": { 
      "type": "array", 
      "items": { "type": "string" }, 
      "description": "e.g. ['vegetarian', 'vegan', 'high-protein', 'spicy']" 
    },
    "excludeAllergens": { 
      "type": "array", 
      "items": { "type": "string" }, 
      "description": "Allergens to strictly exclude e.g. ['MILK', 'PEANUT', 'WHEAT', 'EGG']" 
    }
  }
}
```

### Tool 2: `get_menu_item`
* **Owning Service**: `menu-service`
* **Classification**: Read
* **Target Personas**: Diner, Waiter, Chef, Admin
* **Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "productId": { "type": "string", "description": "Unique ID of the product" }
  },
  "required": ["productId"]
}
```

### Tool 3: `create_menu_item`
* **Owning Service**: `menu-service`
* **Classification**: **Consequential Mutation (Strict Confirmation Required)**
* **Target Personas**: Restaurant Admin, authorized staff
* **Required Privilege**: `MENU_CREATE`
* **Validation & Confirmation Gate**:
  1. User asks Butler to create an item.
  2. Butler gathers required fields and generates a `draftAction` with `actionId`.
  3. UI displays a structured review card: Title, Category, Price, Description, Tags.
  4. Only upon explicit client `confirmation: { actionId, confirmed: true }` does the backend invoke `createProduct`.
* **Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "categoryId": { "type": "string", "description": "Parent category ID" },
    "name": { "type": "string", "description": "Name of the dish" },
    "basePrice": { "type": "number", "description": "Base price in INR (> 0)" },
    "description": { "type": "string", "description": "Detailed description" },
    "dietaryTags": { "type": "array", "items": { "type": "string" } },
    "spiceLevel": { "type": "number", "minimum": 0, "maximum": 5 },
    "preparationTimeMinutes": { "type": "number", "minimum": 0 }
  },
  "required": ["categoryId", "name", "basePrice"]
}
```

### Tool 4: `disable_menu_item`
* **Owning Service**: `menu-service`
* **Classification**: **Consequential Mutation (Confirmation Required)**
* **Target Personas**: Chef, Restaurant Admin
* **Required Privilege**: `MENU_TOGGLE_AVAIL`
* **Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "productId": { "type": "string", "description": "Unique product ID" },
    "isAvailable": { "type": "boolean", "description": "false to mark out-of-stock, true to enable" }
  },
  "required": ["productId", "isAvailable"]
}
```

### Tool 5: `get_order`
* **Owning Service**: `order-service`
* **Classification**: Read
* **Target Personas**: Staff (with `ORDER_READ_ACTIVE`), Customer (scoped to `tableSessionId`)
* **Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "orderId": { "type": "string", "description": "Order UUID" }
  },
  "required": ["orderId"]
}
```

### Tool 6: `get_kitchen_status`
* **Owning Service**: `order-service`
* **Classification**: Read
* **Target Personas**: Chef, Kitchen Manager, Waiter
* **Required Privilege**: `ORDER_READ_ACTIVE`
* **Input Schema**:
```json
{
  "type": "object",
  "properties": {}
}
```

### Tool 7: `get_table_status`
* **Owning Service**: `auth` / `order-service`
* **Classification**: Read
* **Target Personas**: Waiter, Cashier, Admin
* **Required Privilege**: `TABLE_MANAGE` or `ORDER_READ_ACTIVE`
* **Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "tableId": { "type": "string", "description": "Table UUID" }
  },
  "required": ["tableId"]
}
```

### Tool 8: `check_dietary_safety`
* **Owning Service**: `menu-service`
* **Classification**: Read
* **Target Personas**: Customer Personal Dining Agent
* **Safety Rule**: If ingredient or allergen composition is not explicitly documented in MongoDB records, Butler **must explicitly disclose** that information is unverified and **never promise allergen safety**.
* **Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "productId": { "type": "string", "description": "Product ID to inspect" },
    "allergens": { "type": "array", "items": { "type": "string" }, "description": "Allergen codes to verify against" }
  },
  "required": ["productId", "allergens"]
}
```

---

## 5. Dietary Safety & Knowledge Graph Clarification

1. **Current Source of Truth**: MongoDB collections `Ingredient` (name, category, isActive), `Allergen` (code, name, description), and `Product.dietaryTags`.
2. **Knowledge Graph Status**: Knowledge graph graph-relationships are currently stubbed in `menu-service`. Under Section A Task 4, **the structured MongoDB collections serve as the approved source of truth**, keeping graph engine integration purely optional without blocking Butler deployment.
3. **No-Hallucination Guardrail**:
   * If a customer asks: *"Is the Alfredo pasta 100% nut-free?"*
   * Butler inspects the item's recipe ingredients and allergen tags. If the allergen data is absent or inconclusive, Butler must reply:
     > *"Our menu records do not explicitly list all allergen cross-contact details for Alfredo Pasta. Please consult staff directly before ordering if you have severe allergies."*

---

## 6. Entitlement & Commercial Model

* **Entitlement Key**: `BUTLER_AI_ASSISTANT`
* **Level**: Per-restaurant commercial feature add-on managed in Super Admin Platform Dashboard.
* **Dual Gate**:
  1. **Restaurant Level**: Does the restaurant have an active `BUTLER_AI_ASSISTANT` subscription? If false $\rightarrow$ Reject with `403 FEATURE_NOT_ENTITLED`.
  2. **User Level**: Does the caller have the required RBAC privilege for the tool? If false $\rightarrow$ Reject with `403 INSUFFICIENT_PRIVILEGES`.
* **Commercial Parameters**: Configurable billing tiers and usage quotas (stored in database/subscription settings without hard-coding prices or specific payment gateways).
