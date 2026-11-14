# DineFlow Butler: Role-Aware Chatbot and MCP Implementation

## Product decision

DineFlow will provide a conversational assistant named **Butler**. Butler is available in the application UI through a small circular, branded icon. Selecting the icon opens a ChatGPT-style text conversation over the current screen; closing it returns the user to the same screen and preserves the current workflow.

Butler uses JavaScript with **LangChain.js**, **LangGraph.js**, and **Groq** as the LLM provider. LangGraph manages the conversation and tool-use flow; MCP tools perform authorized operations against DineFlow services. The chat API is a backend capability, not a separate FastAPI application.

## Two interfaces for each business capability

Each applicable business capability exposes both interfaces over the same service-layer operation:

1. **HTTP REST API** for the web/mobile UI and other ordinary application clients.
2. **MCP tool interface** for Butler and other authorized agents.

For example, menu capabilities such as listing/searching menu items and creating/updating an item are backed by shared menu service functions. The REST route and MCP tool both call those functions; neither interface duplicates business rules or accesses the database directly. MCP is an agent-facing interface, not a second business logic implementation. Existing domain-specific routes remain distinct operations; the requirement is a corresponding MCP tool wherever an operation is intentionally available to an agent, not mechanically wrapping every low-level/internal route.

```text
React app ── REST route ─────┐
                             ├── Shared service layer ── databases/services
Butler ── LangGraph ── MCP ──┘
```

Keep both interfaces behind the existing gateway and authentication model. Pass the authenticated user's identity, active restaurant/tenant, and role from trusted server-side credentials/context. Enforce authorization and tenant scoping inside the service boundary for both REST and MCP calls. Never trust role, restaurant ID, or permission claims supplied only in chat text or model-generated tool arguments.

## Role-aware Butler behavior

- **Restaurant administrators and permitted staff:** A user can describe a menu item in natural language, including a rough description. Butler gathers missing required details, drafts the structured fields required by the menu schema (for example name, description, category, price, dietary tags, availability, and variants where supported), and presents a review. Butler writes the item only after explicit confirmation, through an authorized MCP tool. The backend validates the fields and the caller's permission before saving.
- **Waiters and other staff:** Butler exposes only the menu and operational actions their assigned role is allowed to perform. Menu creation is enabled only when the backend grants that permission; the UI or LLM cannot grant it.
- **Diners:** Butler understands constraints such as “a meal under ₹500–₹1,000,” searches the active restaurant's available menu through MCP, and explains matching dishes using their stored descriptions and details. If nothing fits, it politely says no matching item was found and may offer the closest available options without claiming they meet the original constraint.
- **All roles:** The graph keeps conversation context, asks follow-up questions when needed, chooses from a bounded set of tools, and reports outcomes in natural language. Tool results are the source of truth for prices, availability, and saved data. Mutating tools require confirmation and backend authorization.

### AI Restaurant Agent capabilities

Butler is also the authorized AI Restaurant Agent for staff operations. It should reason about the request, retrieve relevant context, select a registered tool, let the owning service verify permissions, execute through that service, and report the returned result. Example staff requests include:

- “Disable Paneer Tikka because we are out of stock.” → authorized menu/inventory availability operation.
- “Show me all pending orders for table 12.” → order lookup scoped to the active restaurant and table.
- “Create a combo containing Paneer Pizza and Coke for ₹299.” → draft, review, confirmation, and authorized menu/combo creation.
- “Why is order #482 delayed?” → retrieve order and kitchen status, then explain only what service data supports.
- “Move table 12's order to table 15.” → validate order/table state and scope, confirm the change, and delegate to the owning order/table service.
- “Refund order #482.” → require the dedicated refund privilege (such as `REFUND_ORDER`), validate payment state, and honor configured approval/confirmation requirements.

Potential MCP tools include `get_order`, `get_table_status`, `search_menu`, `update_menu_item`, `disable_menu_item`, `create_combo`, `check_inventory`, and `get_kitchen_status`. The initial tool catalog must be explicitly scoped to operations whose service contract, required privilege, validation, confirmation policy, and failure behavior are defined. The agent must never receive unrestricted database access, arbitrary HTTP access, or direct event-bus publishing authority. The owning microservice remains responsible for state changes and event publication.

Permission checks must be performed by the owning backend service using trusted identity and restaurant context. Tool selection by the LLM is not authorization. Sensitive operations such as refunds require their own privilege and any configured human approval even when the agent identifies the request correctly.

### Customer Personal Dining Agent

For customer sessions, Butler provides a Personal Dining Agent for menu discovery and ordering. It uses the active restaurant's current menu, item availability, prices, structured dietary/allergen and ingredient data, customer preferences when available and consented, current cart, and table/dining-session context. It should answer follow-up questions using these sources and retrieve fresh availability/pricing before cart or order changes.

Example: a customer asks for something spicy under ₹400, asks whether an option contains dairy, then requests dairy-free alternatives. Butler should return available matching items, explain known ingredients/allergens from trusted menu data, and state when ingredient or cross-contact information is unknown. It must not guess that an item is safe for an allergy or dietary restriction. Dietary preferences help rank options; ingredient/allergen restrictions filter results only when the data is sufficiently reliable.

Customer flow:

1. Understand the request and extract constraints such as budget, spice level, dietary preference, and ingredient exclusions.
2. Query the active restaurant's menu and any approved ingredient/knowledge source through bounded MCP tools; verify current item availability and prices.
3. Recommend options with relevant descriptions, price, and evidence-backed dietary/ingredient details. Explain when no matching option exists or data is incomplete.
4. If the customer chooses an item, confirm item, modifiers, quantity, price, and applicable restrictions; then add it to the session's cart through the order/cart service.
5. Before placing an order, show the complete current cart and total and require explicit customer confirmation. The order service performs final price, availability, table/session, and order validation.

The customer's identity (when signed in), restaurant, table, and dining session must come from trusted application context. Guest sessions must use a server-validated session token. The agent must never query another restaurant's catalog or another customer's cart. A knowledge graph is an optional retrieval source only if one is implemented and governed; it does not replace the menu/order services as sources of truth.

## Butler request flow

1. The user opens the circular Butler icon and sends a message from the overlay.
2. The UI sends the message and conversation identifier to the authenticated chat endpoint. Identity and restaurant context are derived/verified server-side.
3. The JavaScript LangGraph agent interprets intent and selects an available MCP tool, or asks the user a follow-up question.
4. The MCP server validates the caller and invokes the same domain service used by its REST counterpart.
5. For writes, Butler returns a structured draft and asks for confirmation before invoking the mutation tool. The service rechecks authorization and validates data at execution time.
6. Butler presents the tool result in the overlay and retains conversation state according to the app's session policy.

## UI requirements

- Add a small circular Butler icon to the authenticated app shell so it is available without navigating away from the current page.
- Clicking it opens a compact, responsive chat panel layered over the current screen, with message history, a text input, send action, loading state, and clear error feedback.
- Include Butler's name and a consistent assistant icon/brand treatment in the panel. Keep the underlying route and user workflow intact when the panel opens or closes.
- Render item drafts and confirmation actions clearly; do not silently execute a database write from generated text.
- Keep accessibility support for keyboard use, focus management, and an accessible label for the launcher.

## Technology boundaries

- **UI:** Existing React application and its current styling/state conventions.
- **Chat orchestration:** Node.js JavaScript using LangChain.js and LangGraph.js, with Groq as the model provider.
- **Business operations:** Existing Node.js/Express services (and Spring Boot auth service as applicable), exposed through paired REST and MCP interfaces where agent access is intended.
- **Data:** Existing PostgreSQL, MongoDB, and Redis responsibilities remain unchanged; Butler does not connect to databases directly.
- **MCP transport:** Use a supported MCP transport appropriate to the deployment and client. Keep it behind the gateway and protected with the same identity/authorization rules; do not assume the old SSE example below is the production transport.

The remaining examples in this file are legacy, generic reference material. They are not the Butler implementation specification. In particular, the FastAPI/LangChain Python sample is not part of the selected stack and must not be used to implement Butler.

## Butler as a monetizable restaurant feature

Butler is an optional, monetizable DineFlow feature that the **DineFlow platform administrator** can make available to a restaurant. A restaurant can use Butler only when its account has an active Butler entitlement. The entitlement is separate from staff roles: entitlement determines whether the restaurant has access to Butler, while the restaurant user's role and permissions determine what that user may do with Butler.

### Platform administration

- Add Butler to DineFlow's platform-level feature/add-on catalog so it can be managed independently of the restaurant's core account.
- Let a DineFlow administrator enable, disable, or change the Butler entitlement for a selected restaurant, with effective dates and an audit record showing who changed it and when.
- Provide entitlement state to the application and backend through the platform's existing account/feature configuration mechanism. Do not rely on hiding the UI button as enforcement.
- When Butler is not entitled or is suspended, hide or disable its launcher and reject chat and MCP-backed Butler operations server-side with a clear feature-unavailable response. Core restaurant functions continue to work.

### Commercial model and restaurant experience

- Treat Butler as a paid add-on or a plan-included feature, according to the commercial package configured by DineFlow. The initial implementation should support entitlement checks without hard-coding a price or billing provider.
- Show restaurant administrators whether Butler is active and, when unavailable, provide a clear route to contact or request activation through the DineFlow account process.
- If later plans include usage limits, enforce them on the server and show usage/limit status to the restaurant administrator. Do not allow the model to bypass limits by switching tools or routes.
- Track usage against the restaurant/account for future billing and support (for example chat requests and model usage), subject to the product's retention and privacy rules. Do not log secrets or unnecessary message content for billing.

### Entitlement enforcement points

Check the restaurant's Butler entitlement before accepting a chat request, before opening or continuing an agent session, and before executing any Butler MCP tool. MCP tools must also independently check the user's role, restaurant scope, and operation permission. This creates two distinct checks: **feature access for the restaurant** and **action authorization for the user**. Record entitlement changes and billable usage in auditable platform records.

Pricing, billing cadence, trial policy, and exact usage limits are product decisions and are intentionally left configurable rather than assumed by this implementation guide.

---

## 🏗️ System Architecture

```
                       ┌─────────────────────────┐
                       │  Mobile / Web App UI    │
                       └────────────┬────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  │ (REST API Call)   (HTTP POST /chat)
                  ▼                                   ▼
      ┌───────────────────────┐           ┌───────────────────────┐
      │  Core REST Endpoints  │           │ FastAPI Demo (Legacy) │
      │  (App Port: 3000/8080)│           │   Gateway (Port 5000) │
      └───────────┬───────────┘           └───────────┬───────────┘
                  │                                   │
                  │ (Direct Call)                     │ (MCP Client over HTTP SSE)
                  ▼                                   ▼
      ┌───────────────────────────────────────────────────────────┐
      │                   Shared Service Layer                    │
      │        (Unified Core Business & Database Logic)           │
      └───────────────────────────────────────────────────────────┘
```

---

## 🛠️ Step 1: Core Service Layer (Choose Node.js or Spring Boot)

This component contains your underlying business logic and exposes it as a standard JSON REST API and an MCP network endpoint using **Server-Sent Events (SSE)**.

### Option A: Node.js (Express + MCP SDK)

#### `package.json`
```json
{
  "name": "mcp-dual-backend-node",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.1",
    "axios": "^1.7.9",
    "express": "^4.21.2"
  }
}
```

#### `userService.js` (Shared Logic)
```javascript
// Single source of truth for both Web App and AI Chatbot
export async function getProfileData(userId) {
  // Replace this boilerplate with live database queries or upstream microservices
  return { 
    userId: userId, 
    status: "Active", 
    tier: "Premium", 
    lastLogin: "2026-09-04" 
  };
}
```

#### `server.js` (Dual HTTP & MCP Setup)
```javascript
import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { getProfileData } from "./userService.js";

const app = express();
app.use(express.json());

// ─────────────────────────────────────────────────────────
// INTERFACE 1: Standard REST API for Web/Mobile Application
// ─────────────────────────────────────────────────────────
app.get("/api/users/:id", async (req, res) => {
  try {
    const data = await getProfileData(req.params.id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────
// INTERFACE 2: MCP Server over HTTP SSE for AI Chatbots
// ─────────────────────────────────────────────────────────
const mcpServer = new Server(
  { name: "dual-use-service", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// 1. Describe tools dynamically to connecting Agents
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "get_user_profile",
    description: "Get user metadata, membership tier, and login history.",
    inputSchema: {
      type: "object",
      properties: { 
        userId: { type: "string", description: "The unique ID of the user account" } 
      },
      required: ["userId"]
    }
  }]
}));

// 2. Handle actual Tool Execution calls from the Agent Client
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "get_user_profile") {
    const { userId } = request.params.arguments;
    const data = await getProfileData(userId);
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  }
  throw new Error("Tool not found");
});

// 3. Bind MCP Transport Layer to Express Router
let transport;
app.get("/mcp/sse", async (req, res) => {
  transport = new SSEServerTransport("/mcp/messages", res);
  await mcpServer.connect(transport);
});

app.post("/mcp/messages", async (req, res) => {
  if (transport) {
    await transport.handleMessage(req, res);
  } else {
    res.status(500).send("MCP Transport has not been initialized yet.");
  }
});

// Start unified web application
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 [REST API] running at http://localhost:${PORT}/api/users/:id`);
  console.log(`🤖 [MCP Server] SSE Endpoint running at http://localhost:${PORT}/mcp/sse`);
});
```

---

### Option B: Java (Spring Boot & Spring AI)

#### `pom.xml` (Dependencies Snippet)
```xml
<dependencies>
    <!-- Standard Web MVC Starter for Application Endpoints -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <!-- Native Spring AI MCP Starter for Tool Transformations -->
    <dependency>
        <groupId>org.springframework.ai</groupId>
        <artifactId>spring-ai-mcp-server-spring-boot-starter</artifactId>
        <version>1.0.0-M1</version>
    </dependency>
</dependencies>
```

#### `application.yml`
```yaml
server:
  port: 8080

spring:
  ai:
    mcp:
      server:
        transport: streamable-http # Automatically maps endpoints to /mcp/sse
```

#### `UserService.java` (Shared Logic)
```java
package com.example.demo.service;

import org.springframework.stereotype.Service;
import java.util.Map;

@Service
public class UserService {
    public Map<String, Object> getUserProfile(String userId) {
        return Map.of(
            "userId", userId,
            "status", "Active",
            "tier", "Premium",
            "lastLogin", "2026-09-04"
        );
    }
}
```

#### `AppController.java` (App Endpoints)
```java
package com.example.demo.controller;

import com.example.demo.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class AppController {

    @Autowired
    private UserService userService;

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getAppUser(@PathVariable String id) {
        return ResponseEntity.ok(userService.getUserProfile(id));
    }
}
```

#### `AgentToolController.java` (MCP Tool Endpoints)
```java
package com.example.demo.controller;

import com.example.demo.service.UserService;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.util.Map;

@Component
public class AgentToolController {

    @Autowired
    private UserService userService;

    @Tool(name = "get_user_profile", description = "Get user metadata, membership tier, and login history.")
    public Map<String, Object> getAgentUser(String userId) {
        // Intercepts intent and points back to the exact same shared database service
        return userService.getUserProfile(userId);
    }
}
```

---

## 🛠️ Step 2: Reference Prototype — FastAPI Chatbot Middleware (MCP Client)

This isolated prototype demonstrates an MCP client using FastAPI and LangChain. It is not part of the finalized DineFlow platform stack. A production DineFlow MCP client should be implemented in Node.js or Spring Boot and must use the platform's existing authorization and tenant isolation.

#### `requirements.txt`
```text
fastapi>=0.110.0
uvicorn>=0.30.0
langchain>=0.1.0
langchain-openai>=0.1.0
mcp-python-client>=1.0.0
pydantic>=2.6.0
```

#### `main.py`
```python
import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# LangChain Orchestration Core
from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.tools import tool

# MCP Networking Utilities
from mcp import ClientSession
from mcp.client.sse import sse_client

# Environment validation
if not os.environ.get("OPENAI_API_KEY"):
    raise ValueError("System Missing Environment Variable: OPENAI_API_KEY must be configured.")

# Global References
mcp_session = None
agent_executor = None

# Configure path pointing to your active Node or Spring Core Backend Service
MCP_SERVER_SSE_URL = "http://localhost:3000/mcp/sse" 

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handles asynchronous connection tracking to the MCP Server during startup and shutdown."""
    global mcp_session, agent_executor
    
    print(f"🔗 Establishing Handshake with Core Service MCP Endpoint: {MCP_SERVER_SSE_URL}...")
    try:
        async with sse_client(MCP_SERVER_SSE_URL) as (read_stream, write_stream):
            async with ClientSession(read_stream, write_stream) as session:
                mcp_session = session
                await session.initialize()
                
                # Fetch schemas from backend
                mcp_tools = await session.list_tools()
                langchain_tools = []

                # Convert Server endpoints into executable Agent functions dynamically
                for mcp_tool in mcp_tools.tools:
                    @tool(name=mcp_tool.name, description=mcp_tool.description)
                    async def dynamic_mcp_tool(arguments: dict, name=mcp_tool.name) -> str:
                        # Fires real-time RPC calls over the network back to core logic
                        result = await mcp_session.call_tool(name, arguments)
                        return result.content.text
                    
                    langchain_tools.append(dynamic_mcp_tool)

                print(f"✅ Dynamic Synchronization Complete. Hooked {len(langchain_tools)} Backend Tools into AI Model Context.")

                # Initialize Assistant Architecture
                llm = ChatOpenAI(model="gpt-4o", temperature=0.2)
                prompt = ChatPromptTemplate.from_messages([
                    ("system", "You are an intelligent chatbot embedded in our application interface. Always use provided tools to cross-reference data accurately."),
                    MessagesPlaceholder(variable_name="chat_history"),
                    ("human", "{input}"),
                    MessagesPlaceholder(variable_name="agent_scratchpad"),
                ])
                
                agent = create_openai_functions_agent(llm, langchain_tools, prompt)
                agent_executor = AgentExecutor(agent=agent, tools=langchain_tools, verbose=True)
                
                yield # Serves client threads continuously until process termination
                
    except Exception as e:
        print(f"❌ Initialization Failed. Ensure Core Service is running first: {str(e)}")
        yield

# Initialize Web Services
app = FastAPI(title="AI Chatbot Agent Gateway", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    user_id: str

class ChatResponse(BaseModel):
    reply: str

@app.post("/api/chat", response_model=ChatResponse)
async def chat_handler(request: ChatRequest):
    global agent_executor
    if not agent_executor:
        raise HTTPException(status_code=503, detail="AI Brain or Core MCP Connection currently disconnected.")
    
    try:
        # Implicit context embedding injection
        contextualized_input = f"[User Session ID Context: {request.user_id}] {request.message}"
        
        # Invoke LangChain Execution Loop
        response = await agent_executor.ainvoke({
            "input": contextualized_input,
            "chat_history": [] # Map active local thread arrays if supporting long memory loops
        })
        
        return ChatResponse(reply=response["output"])
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference Execution Error: {str(e)}")
```

---

## 🏃‍♂️ Verification and Testing Guide

### 1. Boot up the Main Data Backend Service
* **For Node.js:** Execute `npm install` and run `node server.js` (Listens on port `3000`).
* **For Spring Boot:** Execute `mvn spring-boot:run` (Listens on port `8080`).

### 2. Verify Application View Layer Endpoint (REST)
Test that your core front-end system can read static application payloads normally:
```bash
curl http://localhost:3000/api/users/usr_998877
```

### 3. Optional Prototype Only: Boot the FastAPI Chatbot Middleware
Ensure environment tokens are loaded first:
```bash
export OPENAI_API_KEY="your-api-key-here"
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

### 4. Send Message from Chatbot UI Front-End
Simulate a user query targeting conversational logic. Watch the terminal logs to see the LLM automatically interpret the text, call your exposed service tool, and convert raw JSON data back into conversational text.
```bash
curl -X POST http://localhost:5000/api/chat      -H "Content-Type: application/json"      -d '{"user_id": "usr_998877", "message": "Can you check what my account profile status looks like right now?"}'
```

**Output Payload Recieved:**
```json
{
  "reply": "I've checked the logs for your account (ID: usr_998877). Your Premium tier profile is currently Active and functioning normally!"
}
```
