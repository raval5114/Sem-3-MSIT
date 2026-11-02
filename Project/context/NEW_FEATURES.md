# DineFlow — New Feature Specification

## 1. Purpose

This document defines the proposed differentiating features for DineFlow.

The goal is to evolve DineFlow from a conventional restaurant ordering/POS-style application into an **intelligent, context-aware dining and restaurant operations platform**.

These features are intended to complement the existing DineFlow foundation rather than replace it.

### Selected Features

1. AI Restaurant Agent
2. Food Ingredient & Allergen Knowledge Graph
3. Skill-Aware Kitchen Assignment
4. Customer Personal Dining Agent
5. Restaurant Simulation / What-If Engine
6. Dynamic Menu Management

---

# 2. Feature Overview

| Feature | Primary User | Main Purpose |
|---|---|---|
| AI Restaurant Agent | Owner / Manager / Staff | Operate DineFlow using natural language |
| Food Knowledge Graph | Customer + Restaurant | Understand ingredients, allergens and dietary constraints |
| Skill-Aware Kitchen Assignment | Kitchen Manager | Assign orders based on staff skills and availability |
| Personal Dining Agent | Customer | Provide conversational, personalized dining assistance |
| Simulation / What-If Engine | Owner / Manager | Test operational decisions without affecting the real restaurant |
| Dynamic Menu | Admin / Manager | Manage and dynamically control the customer-facing menu |

---

# 3. AI Restaurant Agent

## 3.1 Objective

The AI Restaurant Agent allows authorized restaurant staff to interact with DineFlow using natural language instead of manually navigating multiple administrative screens.

The agent should not merely answer questions. It should be able to **reason about the request, select an appropriate tool, verify permissions, execute the operation through a service API, and report the result**.

### Example Commands

> "Disable Paneer Tikka because we are out of stock."

> "Show me all pending orders for table 12."

> "Create a combo containing Paneer Pizza and Coke for ₹299."

> "Why is order #482 delayed?"

> "Move table 12's order to table 15."

---

## 3.2 Architecture

```text
Restaurant Manager
        |
        v
AI Restaurant Agent
        |
        +--> Intent Detection
        |
        +--> Context Retrieval
        |
        +--> Tool Selection
        |
        +--> Permission Verification
        |
        v
Authorized Tool Call
        |
        v
API Gateway
        |
   +----+----+----+----+
   |    |    |    |    |
  Menu Order Stock Payment Notification
   |    |    |    |    |
   +----+----+----+----+
        |
        v
     Event Bus
```

## 3.3 Important Principle

The AI agent must **never receive unrestricted database access**.

The agent should communicate with DineFlow through controlled tools such as:

```text
get_order()
get_table_status()
search_menu()
update_menu_item()
disable_menu_item()
create_combo()
check_inventory()
get_kitchen_status()
```

This preserves the microservice boundaries.

---

## 3.4 Permission-Aware Execution

Every action should pass through authorization.

```text
User
  |
  v
JWT
  |
  v
Role + Privileges
  |
  v
AI Tool Authorization
  |
  +---- Allowed ----> Execute Tool
  |
  +---- Denied -----> Reject Action
```

Example:

```text
Manager:
"Refund order #482"

        |
        v

AI Agent
        |
        v

Required privilege:
REFUND_ORDER

        |
        +---- Present ----> Payment Service
        |
        +---- Missing ----> Permission Denied
```

---

# 4. Food Ingredient & Allergen Knowledge Graph

## 4.1 Objective

DineFlow should maintain structured knowledge about food items, ingredients, allergens, dietary classifications and relationships between them.

This allows DineFlow to answer questions that cannot be reliably handled by a simple menu database.

---

## 4.2 Example Knowledge Graph

```text
              Paneer Pizza
                   |
          +--------+--------+
          |        |        |
       contains contains  category
          |        |        |
       Paneer    Spice Mix  Pizza
          |
       contains
          |
        Milk
          |
       allergen
          |
       Dairy
```

Another example:

```text
Peanut Sauce
     |
     +---- contains ----> Peanuts
     |
     +---- allergen ----> Nuts
```

---

## 4.3 Customer Queries

The system should support questions such as:

- "Does this contain dairy?"
- "Which dishes contain peanuts?"
- "Show vegetarian dishes without nuts."
- "What can I eat if I don't want milk?"
- "Does this dish contain egg?"
- "Which items are vegan?"

---

## 4.4 Core Entities

```text
FoodItem
Ingredient
Allergen
DietaryTag
Recipe
IngredientRelationship
```

Example:

```text
FoodItem
 ├── Recipe
 │    ├── Ingredient
 │    ├── Ingredient
 │    └── Ingredient
 │
 ├── DietaryTags
 └── PossibleAllergens
```

---

## 4.5 Safety Rule

Allergen information should be treated as restaurant-provided information.

DineFlow should clearly distinguish:

```text
Contains
May Contain
Unknown
```

The system should never claim that a food is allergen-free unless the restaurant has verified the relevant information.

---

# 5. Skill-Aware Kitchen Assignment

## 5.1 Objective

Instead of sending every order to a generic kitchen queue, DineFlow can assign preparation tasks based on:

- Staff skills
- Current availability
- Station
- Workload
- Required preparation skills
- Order priority

---

## 5.2 Staff Skill Model

Example:

```text
Chef A
 ├── Pizza       5/5
 ├── Pasta       3/5
 └── Grill       2/5

Chef B
 ├── Indian      5/5
 ├── Grill       4/5
 └── Pizza       2/5
```

---

## 5.3 Assignment Flow

```text
New Order
    |
    v
Order Items
    |
    v
Determine Required Skills
    |
    v
Find Available Staff
    |
    v
Skill Matching
    |
    v
Check Station Availability
    |
    v
Assign Preparation Task
```

---

## 5.4 Example

Order:

```text
2 x Paneer Pizza
1 x Garlic Bread
```

DineFlow determines:

```text
Required Skills:
- Pizza
- Baking
```

Available workers:

```text
Chef A → Pizza 5/5 → Available
Chef B → Pizza 2/5 → Busy
Chef C → Baking 5/5 → Available
```

DineFlow can distribute the preparation tasks to the most suitable available staff.

---

## 5.5 Manual Override

Kitchen managers must always be able to override automatic assignments.

```text
Automatic Assignment
        |
        +---- Accept
        |
        +---- Reassign
        |
        +---- Cancel
```

---

# 6. Customer Personal Dining Agent

## 6.1 Objective

The Personal Dining Agent provides customers with a conversational interface for discovering and ordering food.

It should understand:

- Current menu
- Availability
- Price
- Dietary preferences
- Ingredient restrictions
- Customer preferences
- Current cart
- Table/dining session context

---

## 6.2 Example Conversation

Customer:

> "I want something spicy under ₹400."

Agent:

> "I found three options. Paneer Tikka Masala with 2 Rotis is ₹350 and has a medium-high spice level."

Customer:

> "Does it contain dairy?"

Agent:

> "Yes. The dish contains paneer and cream."

Customer:

> "Then give me something without dairy."

Agent:

> "I found two available options that match your request."

---

## 6.3 Ordering Flow

```text
Customer
   |
   v
Personal Dining Agent
   |
   +--> Understand Intent
   |
   +--> Query Menu
   |
   +--> Query Knowledge Graph
   |
   +--> Check Availability
   |
   +--> Apply Preferences
   |
   v
Recommendation
   |
   v
Customer Confirmation
   |
   v
Cart
   |
   v
Order Service
```

---

# 7. Restaurant Simulation / What-If Engine

## 7.1 Objective

The Simulation Engine allows restaurant managers to test hypothetical operational changes without changing the real restaurant.

This feature is intentionally different from standard historical analytics.

Analytics answers:

> "What happened?"

Simulation answers:

> "What might happen if we change something?"

---

## 7.2 Example Scenarios

The manager could test:

> "What if I have only two kitchen staff tonight?"

> "What if I close 30% of the tables?"

> "What if I add one more kitchen station?"

> "What if I remove 20 menu items?"

> "What if I add another waiter?"

---

## 7.3 Simulation Architecture

```text
Real Restaurant State
        |
        v
Snapshot / Copy
        |
        v
Simulation Environment
        |
        +--> Tables
        +--> Kitchen Staff
        +--> Stations
        +--> Menu
        +--> Orders
        +--> Operating Rules
        |
        v
Simulation Engine
        |
        v
Scenario Result
```

The simulation must operate on a separate state.

```text
REAL DATABASE
     |
     +---- Simulation Snapshot
                 |
                 v
          Simulation Database
```

The simulation must never modify production restaurant data.

---

## 7.4 Example Result

```text
Scenario:
"Reduce kitchen staff from 5 to 3"

Simulation Result:

Expected kitchen queue:
HIGH

Affected station:
Pizza

Potential result:
- Higher preparation waiting time
- Increased order completion time
- Increased workload per chef

Recommendation:
Keep at least 4 kitchen staff during the selected period.
```

---

# 8. Context-Aware Adaptive Menu System

## 8.1 Why the Original Dynamic Menu Is Not a Differentiator

Basic dynamic menu management should remain part of DineFlow, but it should **not be presented as the unique feature**.

Petpooja already publicly documents centralized menu management, multiple menus, item availability controls, dynamic pricing, add-ons, variations, online menu management, and synchronization across ordering channels. Its current documentation also describes one-screen menu updates and stock-based ON/OFF controls. citeturn0search0turn0search6

Therefore, DineFlow's differentiator should not be:

> "An admin can edit the customer-facing menu without updating the application."

Instead, DineFlow should introduce a **Context-Aware Adaptive Menu System**.

The admin maintains a master menu and defines rules. DineFlow then generates the appropriate customer-facing menu experience using context such as:

- Customer dietary preferences
- Food allergies and ingredient constraints
- Dining session context
- Restaurant availability
- Time-based rules
- Menu rules configured by administrators
- Current menu state
- Customer requests through the Personal Dining Agent

This transforms the menu from a static catalogue into a **decision-driven interface**.

---

## 8.2 Objective

The Adaptive Menu System should answer:

> **"What should this particular customer see right now?"**

rather than only:

> "What items exist in the restaurant?"

The system maintains a master menu but dynamically determines:

- Which items should be displayed
- Which items should be hidden
- Which categories should be prioritized
- Which items should be recommended
- Which banners or promotions should be shown
- Which combinations are relevant to the current customer/context

---

## 8.3 High-Level Architecture

```text
                    MASTER MENU
                        |
                        v
              +-------------------+
              | Menu Rule Engine  |
              +-------------------+
                        |
       +----------------+----------------+
       |                |                |
       v                v                v
Customer Context   Food Knowledge    Restaurant State
       |                |                |
       +----------------+----------------+
                        |
                        v
              ADAPTIVE MENU ENGINE
                        |
                        v
              Customer-Specific Menu
                        |
                        v
                 Customer App
```

---

## 8.4 Admin Side: Master Menu

The admin still manages the underlying menu.

The admin can configure:

- Categories
- Food items
- Images
- Prices
- Descriptions
- Ingredients
- Allergens
- Dietary tags
- Spice level
- Availability
- Variants
- Add-ons
- Combos
- Promotions
- Menu sections
- Display priority
- Context rules

These are **configuration capabilities**, not the primary differentiator.

---

## 8.5 Context Rules

The administrator can define rules that influence the customer-facing menu.

### Example: Time-Based Menu

```text
IF current_time = 08:00 - 11:00

THEN
    activate Breakfast Menu
```

### Example: Availability

```text
IF ingredient_stock < minimum_threshold

THEN
    mark dependent items unavailable
```

### Example: Customer Preference

```text
IF customer.diet = VEGETARIAN

THEN
    prioritize vegetarian items
```

### Example: Dietary Restriction

```text
IF customer.allergens contains PEANUT

THEN
    hide items containing PEANUT
```

### Example: Price Constraint

```text
IF customer_budget <= ₹400

THEN
    prioritize items <= ₹400
```

---

## 8.6 Adaptive Menu Generation

The menu generation process should follow:

```text
Master Menu
     |
     v
Check Availability
     |
     v
Apply Restaurant Rules
     |
     v
Apply Customer Context
     |
     v
Apply Food Knowledge Constraints
     |
     v
Rank / Organize Items
     |
     v
Generate Customer Menu
```

The master menu is not modified for every customer.

Instead, DineFlow creates a **contextual view** of the master menu.

---

## 8.7 Example

Restaurant master menu:

```text
100 Items
```

Customer context:

```text
Diet: Vegetarian
Allergy: Peanuts
Budget: ₹500
Preference: Spicy
```

DineFlow processes the context:

```text
100 Items
   |
   +---- Remove unavailable items
   |
   +---- Remove non-vegetarian items
   |
   +---- Remove peanut-containing items
   |
   +---- Filter/rank by price
   |
   +---- Prioritize spicy items
   |
   v
Personalized Menu
```

Customer sees:

```text
Recommended For You
────────────────────────

🌶 Paneer Tikka
🌶 Veg Biryani
🌶 Masala Paneer
🌶 Spicy Veg Pizza

Other Suitable Items
────────────────────────
Dal Tadka
Garlic Naan
Veg Fried Rice
```

---

## 8.8 Integration with Food Knowledge Graph

The Adaptive Menu should use the Food Ingredient & Allergen Knowledge Graph.

```text
Customer
   |
   | Allergy: Peanut
   v
Adaptive Menu Engine
   |
   v
Knowledge Graph
   |
   +---- Item A → Contains Peanut → HIDE
   |
   +---- Item B → May Contain Peanut → WARN
   |
   +---- Item C → No Known Peanut → ALLOW
```

This creates a strong relationship between the two features.

---

## 8.9 Integration with Personal Dining Agent

The Personal Dining Agent should be able to modify the customer's menu context through conversation.

Example:

```text
Customer:
"I want something spicy under ₹400."

             |
             v

Personal Dining Agent
             |
             v

Context:
spice = high
budget = 400

             |
             v

Adaptive Menu Engine
             |
             v

Updated Menu View
```

Customer can then say:

> "I don't want dairy."

The system updates the context and regenerates the menu.

---

## 8.10 Integration with Restaurant State

The menu should react to operational state.

```text
Kitchen / Inventory
        |
        v
Restaurant State
        |
        v
Adaptive Menu Engine
        |
        v
Customer Menu
```

Example:

```text
Paneer stock unavailable
        |
        v
Paneer Pizza unavailable
        |
        v
Remove from customer menu
        |
        v
AI Dining Agent also stops recommending it
```

This is different from simply allowing an admin to manually toggle a menu item.

---

## 8.11 Menu Rule Engine

Rules should be stored as structured configurations rather than hard-coded into the frontend.

Example:

```json
{
  "name": "Vegetarian Customer Rule",
  "condition": {
    "customerDiet": "VEGETARIAN"
  },
  "action": {
    "excludeTags": ["NON_VEGETARIAN"],
    "priorityTags": ["VEGETARIAN"]
  },
  "enabled": true
}
```

Another example:

```json
{
  "name": "Breakfast Menu Rule",
  "condition": {
    "timeBetween": ["08:00", "11:00"]
  },
  "action": {
    "activateMenu": "BREAKFAST"
  },
  "enabled": true
}
```

The actual production representation can be normalized into database tables rather than storing arbitrary executable code.

---

## 8.12 Admin Rule Builder

The admin should not need to write JSON or code.

A visual rule builder can expose:

```text
WHEN
[ Customer Diet ] [ is ] [ Vegetarian ]

THEN
[ Prioritize ] [ Vegetarian Items ]

AND
[ Hide ] [ Non-Vegetarian Items ]
```

Another example:

```text
WHEN
[ Time ] [ between ] [ 18:00 - 22:00 ]

THEN
[ Promote ] [ Dinner Combos ]
```

This makes the feature practical for restaurant administrators.

---

## 8.13 Customer Menu Rendering

The frontend should consume a menu response generated by the Adaptive Menu Service.

Example:

```json
{
  "menuContext": {
    "sessionId": "session_123",
    "customerContext": true
  },
  "sections": [
    {
      "name": "Recommended For You",
      "items": []
    },
    {
      "name": "Starters",
      "items": []
    },
    {
      "name": "Main Course",
      "items": []
    }
  ]
}
```

The frontend should focus on **rendering the menu**, while decision-making remains in backend services.

---

## 8.14 Event-Driven Updates

The Adaptive Menu should react to domain events.

```text
MenuUpdated
InventoryChanged
ItemSoldOut
ItemAvailable
IngredientChanged
RestaurantRuleChanged
CustomerPreferenceChanged
```

Example:

```text
Inventory Service
       |
       | ItemSoldOut
       v
    Event Bus
       |
       +----> Menu Service
       |
       +----> Adaptive Menu Engine
       |
       +----> Personal Dining Agent
```

This ensures that different parts of DineFlow remain consistent.

---

## 8.15 What Makes This Different

The differentiation is **not**:

```text
Admin edits menu
        ↓
Customer sees updated menu
```

Petpooja already provides extensive centralized menu management and online menu controls. citeturn0search0turn0search5turn0search6

The differentiating model is:

```text
             MASTER MENU
                  |
          +-------+-------+
          |       |       |
      Customer   Food   Restaurant
       Context   Graph    State
          |       |       |
          +-------+-------+
                  |
                  v
        CONTEXTUAL DECISION
                  |
                  v
          ADAPTIVE MENU
                  |
                  v
              CUSTOMER
```

DineFlow therefore becomes capable of presenting **different appropriate menu experiences to different customers without changing the underlying master menu**.

---

## 8.16 Updated Feature Positioning

### Basic Capability

**Dynamic Menu Management**

- Admin-controlled menu
- Categories
- Items
- Prices
- Availability
- Variations
- Add-ons
- Promotions

### Differentiating Capability

**Context-Aware Adaptive Menu**

- Customer-specific menu composition
- Dietary-aware filtering
- Allergen-aware filtering
- Preference-aware prioritization
- Contextual menu rules
- Time-based menu activation
- Restaurant-state-aware menu
- Personal Dining Agent integration
- Food Knowledge Graph integration
- Real-time event-driven adaptation

The first group is standard restaurant software functionality.

The second group is the **DineFlow-specific intelligent feature**.

---

# 9. Service Architecture Impact

The new features can be integrated into the existing microservice architecture.

```text
                         API Gateway
                              |
        +---------------------+---------------------+
        |                     |                     |
        v                     v                     v
   Auth Service          Restaurant Services     AI Layer
                             |                     |
                    +--------+--------+            |
                    |        |        |            |
                  Menu     Order   Kitchen         |
                    |        |        |            |
                    +--------+--------+            |
                             |                     |
                         Event Bus <---------------+
                             |
              +--------------+--------------+
              |              |              |
         Notification     Inventory      Payment
```

### New Components

```text
AI Restaurant Agent
Customer Dining Agent
Knowledge Graph Service
Kitchen Assignment Engine
Simulation Engine
Dynamic Menu Service
```

---

# 10. Final Platform Technology Stack

The selected DineFlow platform stack is **React, Node.js, Spring Boot, PostgreSQL, MongoDB, Redis, and Docker**. These are the implementation choices for the platform; alternatives mentioned in older examples are not selected platform technologies.

| Area | Selected technology and responsibility |
|---|---|
| Frontend | React for the customer PWA, staff/kitchen interfaces, and admin portal. |
| Backend | Node.js for menu, order, payment, and real-time services; Spring Boot for authentication/security and applicable domain services. |
| Relational data | PostgreSQL for users, orders, payments, invoices, and table sessions. |
| Catalog/document data | MongoDB for flexible menu, ingredient, recipe, variant, and modifier data. |
| Cache and messaging | Redis for caching, session data, and Pub/Sub. |
| Containers | Docker for packaging and running the platform services. |

AI agents and MCP integration must be implemented as capabilities within these selected backend technologies. A separate AI framework or provider may be evaluated later, but it is not part of the finalized platform stack in this document.

---

# 11. Security Requirements

The new AI capabilities must follow the existing DineFlow security model.

### AI must not bypass authorization.

```text
Human User
    |
    v
JWT Authentication
    |
    v
Role / Privilege
    |
    v
AI Agent
    |
    v
Authorized Tool
    |
    v
Microservice
```

### Required protections

- Tenant isolation
- Restaurant-level authorization
- Role-based access control
- Privilege-based tool access
- Input validation
- Tool allowlisting
- Audit logs
- Rate limiting
- Confirmation for destructive operations
- No direct database access from LLMs

---

# 12. Auditability

Every AI-triggered operation should produce an audit record.

```text
AuditLog

userId
restaurantId
agentId
action
tool
arguments
timestamp
authorizationResult
executionResult
```

Example:

```text
User:
manager_102

Action:
disable_menu_item

Item:
Paneer Pizza

Reason:
Out of stock

Authorization:
ALLOWED

Result:
SUCCESS
```

This makes AI operations traceable and defensible.

---

# 13. Feature Interaction

The real strength of these features comes from their interaction.

```text
                  Dynamic Menu
                       |
                       v
              Food Knowledge Graph
                       |
             +---------+---------+
             |                   |
             v                   v
     Personal Dining       AI Restaurant
          Agent                Agent
             |                   |
             +---------+---------+
                       |
                       v
                    Order
                       |
                       v
              Skill-Aware Kitchen
                       |
                       v
                 Restaurant State
                       |
                       v
              Simulation Engine
```

Example:

1. Admin updates an item's ingredients.
2. Knowledge Graph is updated.
3. Customer Dining Agent immediately uses the new information.
4. Customer places an order.
5. Kitchen Assignment Engine determines the appropriate staff.
6. Restaurant state is updated.
7. The manager can later simulate alternative staffing scenarios.

This creates a **connected intelligent system**, rather than a collection of unrelated features.

---

# 14. Recommended Development Priority

## Phase 1 — Dynamic Menu

Build first because all other features depend heavily on reliable menu data.

- Menu CRUD
- Categories
- Items
- Variants
- Add-ons
- Ingredients
- Availability
- Draft/Publish
- Versioning

## Phase 2 — Food Knowledge Graph

- Ingredient relationships
- Allergens
- Dietary tags
- Recipe mapping
- Menu validation

## Phase 3 — Customer Personal Dining Agent

- Menu search
- Conversational recommendations
- Knowledge Graph queries
- Cart integration
- Order confirmation

## Phase 4 — AI Restaurant Agent

- Tool calling
- Restaurant context
- RBAC integration
- Secure tool execution
- Audit logging

## Phase 5 — Skill-Aware Kitchen

- Staff profiles
- Skills
- Kitchen stations
- Assignment engine
- Manual override

## Phase 6 — Simulation Engine

- Restaurant snapshots
- Scenario configuration
- Simulation engine
- Result generation
- Scenario comparison

---

# 15. Final DineFlow Positioning

The existing DineFlow functionality provides the operational foundation:

```text
Ordering
Billing
Kitchen
Payment
Notification
Restaurant Administration
```

The new features add an intelligence and orchestration layer:

```text
                 DINEFLOW
                    |
      +-------------+-------------+
      |             |             |
      v             v             v
   CUSTOMER      RESTAURANT     KITCHEN
      |             |             |
      v             v             v
Personal AI     AI Agent      Skill Engine
      |             |             |
      +-------------+-------------+
                    |
                    v
          Food Knowledge Graph
                    |
                    v
             Dynamic Menu
                    |
                    v
           Restaurant State
                    |
                    v
          Simulation Engine
```

### Final project statement

> **DineFlow is an intelligent, context-aware restaurant platform that combines dynamic menu management, conversational dining assistance, food knowledge reasoning, AI-powered restaurant operations, skill-aware kitchen orchestration, and operational simulation on top of a secure microservice architecture.**

The key differentiator is not simply **"DineFlow has AI."**

The differentiator is:

> **DineFlow allows both customers and restaurant staff to interact intelligently with the same real-time restaurant ecosystem while enforcing permissions, understanding food context, coordinating kitchen operations, and allowing managers to safely simulate operational decisions.**
