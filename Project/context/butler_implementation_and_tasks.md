# Butler Chatbot and Restaurant Feature Entitlement

**Status:** Design and task breakdown documented; product implementation has not started.
**Scope:** Role-aware conversational AI Restaurant Agent and Customer Personal Dining Agent (Butler), paired REST/MCP business interfaces, and Butler's monetizable restaurant entitlement.
**Related guide:** [project.mcp_implementation_guide.md](project.mcp_implementation_guide.md)

## 1. Goal

Add **Butler**, DineFlow's conversational AI Restaurant Agent and Customer Personal Dining Agent, embedded in the app. A small circular Butler icon opens a ChatGPT-style text panel over the current screen. Authorized restaurant staff can ask Butler to inspect or perform restaurant operations in natural language; diners can use it to discover dishes, manage their current cart, and proceed through ordering. Butler uses JavaScript, LangChain.js, LangGraph.js, and Groq. It uses controlled MCP tools for authorized actions and service data, while ordinary application clients continue to use HTTP REST APIs.

Butler is an optional feature that DineFlow platform administrators can enable for individual restaurants. Entitlement determines whether a restaurant can use Butler; the authenticated user's role and privileges determine which Butler actions that user can take.

## 2. Architecture

```text
Customer / staff React UI
  ├── ordinary application actions ── HTTP REST ──┐
  └── Butler chat overlay ── authenticated chat API ── LangGraph.js + LangChain.js + Groq
                                                       └── MCP client ── MCP tools
HTTP REST routes ───────────────────────────────────────────────────────┐
MCP tool handlers ──────────────────────────────────────────────────────┴── shared domain services
                                                                            └── existing databases/services
```

For each business operation that Butler is permitted to use, expose a corresponding MCP tool alongside the existing or new REST API operation. Both entry points must call the same domain/service function. Do not duplicate business rules, make MCP handlers access databases directly, or wrap every internal route as an agent tool without a defined use case.

The agent can reason about requests, retrieve relevant context, choose an appropriate tool, verify authorization through trusted service context, execute an operation through the owning service, and report the result. It must never receive unrestricted database access or bypass API gateway/service boundaries. Event-producing operations must use the owning service's existing event publication path; the agent must not publish arbitrary events itself.

The chat endpoint belongs to the existing Node.js application/service architecture. LangGraph orchestrates the conversation, follow-up questions, state, and tool selection; LangChain.js provides model/tool integrations; Groq supplies the LLM. Butler must not use the legacy FastAPI/Python prototype as its production implementation.

## 3. Core user journeys

### Restaurant staff: create a menu item

1. An authorized user tells Butler the item's name and rough description.
2. Butler uses the menu schema to draft required fields, asks for missing information, and shows a structured preview.
3. The user explicitly confirms the draft.
4. Butler calls the menu-create MCP tool. The menu service independently validates fields, restaurant scope, entitlement, and the user's create permission before persisting.
5. Butler reports the result based on the service response.

Waiters may create or edit menu items only if their configured role grants that action. Do not infer permission from job title, prompt text, or LLM output.

### Diner: find a meal

1. A diner asks in natural language, for example “Find me a meal between ₹500 and ₹1,000.”
2. Butler extracts constraints and calls a menu-search MCP tool scoped to the authenticated session's active restaurant and currently available items.
3. Butler explains matching items using returned menu data. If there are no matches, it says so clearly and may offer the closest options while identifying that they fall outside the requested constraints.

### Customer Personal Dining Agent: discover, personalize, and order

The customer agent understands current menu, availability, prices, dietary preferences, ingredient restrictions, saved/expressed preferences (when available and permitted), current cart, and table/dining-session context.

Example: “I want something spicy under ₹400.” Butler finds matching available dishes and gives evidence-based price/spice details. If asked whether a dish contains dairy, it uses structured ingredient/allergen data. If the customer then asks for dairy-free options, it filters/recommends suitable available dishes based on reliable data and clearly identifies unknown ingredient or cross-contact information. It must not claim allergy safety when the source data is missing or uncertain.

Ordering flow:

1. Extract intent and constraints, asking a follow-up question when needed.
2. Query menu and, where available, an approved ingredient/knowledge source; check real-time availability and price through service tools.
3. Return recommendations grounded in tool results and explain no-match or incomplete-data cases.
4. On selection, confirm item, modifiers, quantity, price, and relevant restriction details; add to the correct session cart through the cart/order service.
5. Before order submission, present the full cart and total and require explicit customer confirmation. The order service revalidates menu availability, prices, dining/table session, and order rules.

Customer context must be scoped to the active restaurant and validated dining session. Signed-in identity comes from the authenticated session; guest identity comes from a server-validated guest session token. A knowledge graph is an optional source only if implemented; it does not replace menu, cart, or order services as the source of truth.

### DineFlow admin: manage restaurant access

1. A platform administrator selects a restaurant and enables, suspends, or changes its Butler entitlement through platform administration.
2. The system records the actor, restaurant, change, timestamp, effective period, and resulting status.
3. Butler availability updates in the UI and backend. Requests and tool calls are rejected server-side when the entitlement is inactive.

### Restaurant staff: operational requests

The approved tool set may grow across service domains. Examples include:

- “Disable Paneer Tikka because we are out of stock.” → check the user's menu/inventory privilege, identify the correct restaurant item, confirm the target if ambiguous, and update availability through the menu/inventory service.
- “Show me all pending orders for table 12.” → resolve table 12 within the active restaurant and retrieve matching orders through the order service.
- “Create a combo containing Paneer Pizza and Coke for ₹299.” → check combo/menu-write privilege, gather missing required fields, preview the combo, require explicit confirmation, then create through the menu service.
- “Why is order #482 delayed?” → fetch authorized order and kitchen status/context, explain the evidence returned, and avoid claiming a cause that the service data does not support.
- “Move table 12's order to table 15.” → check order/table privileges, verify both tables and order belong to the active restaurant and are in a movable state, show the proposed change, confirm, then call the order/table service.
- “Refund order #482.” → require the dedicated refund privilege (for example `REFUND_ORDER`), validate payment/order state through the payment service, and require any configured confirmation or approval before executing.

These are capability examples, not permission grants. The initial release should only expose tools whose owning service, input contract, authorization rule, and failure behavior are defined.

## 4. Product and technical constraints

### Identity, authorization, and data isolation

- Derive identity from the authenticated session/token and validate it server-side. Do not accept user ID, role, privileges, or restaurant ID as trusted chat fields.
- Resolve the active restaurant/tenant from trusted application context and scope every menu read and write to it.
- Apply authorization in shared service functions for both REST and MCP calls. MCP tool schemas and UI visibility are not authorization controls.
- Check both feature entitlement and user permission for each Butler request/action. A restaurant's active Butler subscription does not give every user menu-write access.
- Recheck authorization, entitlement, and relevant data constraints at mutation execution time, including after user confirmation.

### Agent behavior and writes

- Treat the LLM as an intent interpreter and response generator, never as the source of truth for prices, availability, permissions, or persisted state.
- Ground customer recommendations in current menu/service data. Dietary preferences can rank results; ingredient and allergen restrictions require reliable structured data. Disclose unknown ingredient/cross-contact data and never promise allergy safety based on inference.
- Use a bounded, typed tool set with validated input schemas and predictable error results.
- Ask follow-up questions when required fields or constraints are ambiguous. Do not invent required menu data.
- Require explicit user confirmation before creating/updating/deleting records or performing other consequential actions.
- For customer ordering, confirm cart changes as appropriate and always show the final cart and total for explicit confirmation before order submission; the order service must revalidate at submission.
- Make mutating operations safe against duplicate submissions (idempotency or equivalent) and return a clear saved/failed result.
- Keep conversation state isolated by authenticated user and restaurant. Apply the product's session retention and privacy policy; avoid retaining unnecessary sensitive message content.
- For guest dining sessions, use server-validated session tokens and isolate carts/conversation context by restaurant and dining session. Never expose another customer's cart or preferences.

### UI and accessibility

- Provide a small circular, keyboard-accessible Butler launcher in the authenticated app shell.
- Open a responsive overlay without navigating away or losing the current screen's state; support close/reopen and conversation continuity according to session policy.
- Show Butler name/icon, messages, input, send action, loading state, and clear errors. Render structured drafts with explicit confirm/cancel controls.
- Include accessible labeling, visible focus, and keyboard navigation. Do not expose implementation jargon to diners or staff.

### Entitlement and monetization

- Model Butler as a separately managed feature/add-on or plan entitlement per restaurant. Platform administration controls activation/suspension; restaurant administrators can view status.
- Enforce entitlement server-side on chat session creation/continuation and before MCP-backed actions. Hiding the launcher alone is insufficient.
- When inactive, explain that Butler is unavailable and provide the restaurant's account/activation path. Core DineFlow functionality remains usable.
- Keep plan/entitlement checks independent from role permissions. Record entitlement changes in an audit trail.
- Design for usage metering and optional future limits, but keep price, billing cadence, trial policy, and quota values configurable. Do not invent commercial terms or hard-code a billing provider.
- Attribute usage to the restaurant for billing/support without logging secrets or unnecessary message content.

### Integration and operations

- Reuse the existing React app shell, gateway, authentication, service conventions, and database ownership boundaries.
- Choose a supported MCP transport for the deployed architecture; do not treat the old SSE example as a fixed production decision.
- Keep Groq credentials and service credentials server-side. Configure model/provider through environment or secret management, not frontend bundles.
- Provide operational logging for tool name, outcome, latency, caller/restaurant identifiers, and correlation ID while respecting privacy requirements.
- Define graceful behavior for Groq, MCP, or downstream service outages; the normal REST application must remain usable.

## 5. Task list and completion record

Status meanings: `[x]` completed, `[ ]` not started or not yet verified. Documentation tasks can be complete while implementation tasks remain open.

### Completed in this planning task

- [x] Record the Butler product intent: conversational, role-aware, and MCP-tool oriented.
- [x] Record paired REST/MCP interfaces over shared business services.
- [x] Specify JavaScript LangChain.js + LangGraph.js with Groq.
- [x] Specify circular Butler launcher and chat overlay in the app UI.
- [x] Specify role-based menu drafting, review, confirmation, and diner menu recommendations.
- [x] Specify the Customer Personal Dining Agent's menu discovery, dietary/ingredient constraints, current-cart context, and confirmed ordering flow.
- [x] Specify Butler as a monetizable per-restaurant feature managed by DineFlow administrators.
- [x] Document security, entitlement, confirmation, tenancy, UI, and commercial-model constraints.
- [x] Create this task breakdown and explicitly distinguish completed planning from pending product implementation.

### Pending product implementation

#### A. Discovery and contracts

- [ ] Map current frontend entry points, menu schemas, menu service APIs, role/permission model, restaurant context, and platform subscription/entitlement model.
- [ ] Define the initial Butler tool catalog and input/output schemas for menu search, menu draft validation, and authorized menu creation.
- [ ] Define customer dining tools and contracts for menu search/filter, item detail/ingredient lookup, availability/price refresh, session cart read/update, and order submission.
- [ ] Determine whether an ingredient knowledge graph exists; if not, define an approved structured menu/allergen data source and keep graph integration optional.
- [ ] Inventory operational intents and approve a release-scoped tool catalog across menu, order, table, stock/inventory, payment, kitchen status, and notification domains.
- [ ] For each proposed tool, document owning service, required privilege, restaurant scope, read/write classification, confirmation/approval policy, validation, idempotency, and error contract.
- [ ] Define chat request/response contracts, conversation identifiers, confirmation state, and error codes.
- [ ] Decide MCP transport, deployment topology, and session lifecycle based on the existing gateway and services.
- [ ] Select initial model configuration and Groq model via server-side configuration; define timeout and fallback behavior.
- [ ] Product decision: choose pricing, billing cadence, trial policy, and initial usage limits (if any). Keep implementation configurable until decided.

#### B. Shared services and paired interfaces

- [ ] Refactor or expose menu operations through shared service functions used by REST and MCP handlers.
- [ ] Implement REST routes for any missing UI-facing menu operations while preserving existing API contracts.
- [ ] Implement MCP server registration and authorized tools for the approved Butler capabilities.
- [ ] Implement approved read tools such as `get_order`, `get_table_status`, `search_menu`, `check_inventory`, and `get_kitchen_status` through their owning services.
- [ ] Implement customer-scoped read tools for menu details, availability, price, ingredients/allergens, cart, and dining session context through the owning services.
- [ ] Implement cart and order tools through the order service, with session ownership checks, price/availability revalidation, idempotency, and final order confirmation.
- [ ] Implement approved write tools such as `update_menu_item`, `disable_menu_item`, and `create_combo` only after each service contract and privilege is confirmed; add order/table/payment tools in their owning services when approved.
- [ ] Prevent the agent from directly calling databases, arbitrary HTTP URLs, unregistered tools, or event-bus publishing interfaces.
- [ ] Propagate verified identity, restaurant scope, and correlation context to both interfaces.
- [ ] Enforce authorization, tenant isolation, schema validation, entitlement, and idempotency in shared service boundaries.
- [ ] Add structured errors and audit events for reads, writes, denied actions, and entitlement failures.

#### C. Butler orchestration service

- [ ] Add a JavaScript chat service using LangChain.js and LangGraph.js with Groq integration.
- [ ] Implement graph state for user/restaurant context, conversation turns, tool results, draft fields, and confirmation status.
- [ ] Connect the agent to MCP tools with allowlisted tool discovery and typed validation.
- [ ] Implement menu-item draft generation and follow-up questions based on actual menu schema.
- [ ] Require explicit confirmation and revalidate permissions/entitlement immediately before menu mutations.
- [ ] Apply risk-aware confirmation to operational mutations; require dedicated privileges for sensitive actions such as refunds and preserve configured human approval requirements.
- [ ] Ground explanations such as order-delay answers in returned order/kitchen evidence, and state when available data cannot establish a cause.
- [ ] Implement constrained menu search and responses grounded in MCP results; report no-match cases accurately.
- [ ] Implement customer preference/constraint parsing and recommendations grounded in current menu results.
- [ ] Handle dietary/allergen questions safely: do not infer missing ingredients, disclose incomplete data/cross-contact uncertainty, and never guarantee allergen safety without authoritative support.
- [ ] Implement cart selection/update and final order confirmation flow; ensure the order service remains authoritative for totals and submission.
- [ ] Add per-user/per-restaurant conversation isolation, session expiry, request limits, and safe failure responses.
- [ ] Keep Groq and MCP secrets in server-side configuration and add provider/service health visibility.

#### D. Butler UI

- [ ] Add Butler launcher icon and name/brand treatment to the authenticated React app shell.
- [ ] Build responsive overlay with conversation view, input, send action, loading/error states, and close/reopen behavior.
- [ ] Render item drafts with editable/reviewable fields and explicit confirm/cancel actions.
- [ ] Show entitlement-unavailable state and an account activation path to restaurant administrators.
- [ ] Implement accessibility and preserve underlying route and screen state.
- [ ] Connect the UI to the authenticated chat API and render service/tool outcomes without fabricating success.

#### E. Restaurant feature entitlement and DineFlow admin

- [ ] Confirm where platform-level restaurant subscriptions and features currently live.
- [ ] Add Butler entitlement state with active/suspended status, effective dates, and audit fields using existing account/feature conventions.
- [ ] Add DineFlow admin controls to activate, suspend, or change Butler availability for a restaurant.
- [ ] Expose entitlement status securely to the app/backend; do not treat frontend state as authoritative.
- [ ] Enforce entitlement on chat requests and every Butler MCP action.
- [ ] Show status and activation guidance to restaurant administrators.
- [ ] Add usage metering hooks attributed to restaurant/account; wire billing or quotas only after commercial decisions are approved.

#### F. Delivery and acceptance

- [ ] Verify REST and MCP calls produce equivalent domain behavior and use the same service validation.
- [ ] Verify unauthorized roles cannot read/write beyond their privileges through either interface.
- [ ] Verify restaurant A cannot access restaurant B menu data through chat, REST, or MCP.
- [ ] Verify inactive Butler entitlement blocks chat and tool execution even if a client calls endpoints directly.
- [ ] Verify menu draft requires confirmation and no write occurs before confirmation; verify duplicate confirmation does not create duplicates.
- [ ] Verify diner constraints, availability, no-match wording, and returned item facts against live menu service results.
- [ ] Verify customer dietary and ingredient restriction handling, including missing/uncertain allergen data and cross-contact disclosures.
- [ ] Verify customer cart isolation across restaurants and dining sessions, and that no order submits without explicit final confirmation and server-side revalidation.
- [ ] Verify each operational tool enforces its required privilege and restaurant scope independently of the LLM's tool choice.
- [ ] Verify sensitive actions (including refunds) are denied without their dedicated privilege and that confirmation/approval policies are honored.
- [ ] Verify order/table state transitions and event publication are performed by owning services, not by the agent runtime.
- [ ] Verify Butler launcher and panel behavior across customer, waiter, restaurant admin, and platform admin experiences as applicable.
- [ ] Document deployment configuration, Groq secret setup, MCP transport, entitlement operations, and support troubleshooting.

## 6. Acceptance criteria

The feature is ready for release when:

1. Butler is reachable from the authenticated UI through its circular icon and opens a usable text overlay without losing the active screen.
2. The production agent uses JavaScript LangChain.js/LangGraph.js and Groq, and invokes business capabilities through MCP.
3. Applicable operations have REST and MCP entry points backed by shared domain logic.
4. A permitted staff user can produce a menu draft, review it, confirm it, and receive truthful save status; an unauthorized user cannot perform the mutation.
5. A diner receives menu recommendations grounded in the active restaurant's available menu and accurate no-match behavior.
6. DineFlow administrators can manage per-restaurant Butler entitlement, and inactive entitlement is enforced by the backend.
7. User permissions, restaurant isolation, feature entitlement, and write confirmation are independently enforced on every relevant server-side path.
8. Pricing and limits remain configuration/product decisions unless a commercial policy is explicitly set.
