# 📊 Data Flow Diagrams (DFD) & Use Case Diagrams Specification
## Smart Contactless Dining Platform (SCDP / DineFlow)

> **Document Version**: 1.0.0  
> **Target Specification**: [project.spec.md](file:///d:/project/Sem-3-MSIT/Project/context/project.spec.md) & [project.architect.md](file:///d:/project/Sem-3-MSIT/Project/context/project.architect.md)  
> **Status**: Comprehensive Analysis & Engineering Architecture Artifact  

---

## 📑 Table of Contents
1. [Overview & Conventions](#1-overview--conventions)
2. [Data Flow Diagrams (DFD)](#2-data-flow-diagrams-dfd)
   - [2.1 Level 0: Context Data Flow Diagram (Top-Level)](#21-level-0-context-data-flow-diagram-top-level)
   - [2.2 Level 1: Subsystem Data Flow Diagram (Middle-Level)](#22-level-1-subsystem-data-flow-diagram-middle-level)
   - [2.3 Level 2: Detailed Data Flow Diagrams (Lower-Level)](#23-level-2-detailed-data-flow-diagrams-lower-level)
     - [2.3.1 DFD 2.0 - Order Processing & Validation Subsystem](#231-dfd-20---order-processing--validation-subsystem)
     - [2.3.2 DFD 3.0 - Kitchen Routing & KDS Workflow Subsystem](#232-dfd-30---kitchen-routing--kds-workflow-subsystem)
     - [2.3.3 DFD 4.0 - Payment Processing & Digital Invoicing Subsystem](#233-dfd-40---payment-processing--digital-invoicing-subsystem)
     - [2.3.4 DFD 5.0 - Inventory Tracking & Depletion Subsystem](#234-dfd-50---inventory-tracking--depletion-subsystem)
3. [DFD Data Dictionary](#3-dfd-data-dictionary)
4. [Use Case Diagrams](#4-use-case-diagrams)
   - [4.1 Complete System-Wide Use Case Diagram](#41-complete-system-wide-use-case-diagram)
   - [4.2 Customer Self-Ordering & Dining Subsystem](#42-customer-self-ordering--dining-subsystem)
   - [4.3 Kitchen Display System (KDS) & Chef Operations](#43-kitchen-display-system-kds--chef-operations)
   - [4.4 Waitstaff & Floor Service Operations](#44-waitstaff--floor-service-operations)
   - [4.5 Cashier & Billing Settlement](#45-cashier--billing-settlement)
   - [4.6 Restaurant Management & Administrative Operations](#46-restaurant-management--administrative-operations)
5. [Key Use Case Detailed Specifications](#5-key-use-case-detailed-specifications)

---

## 1. Overview & Conventions

### 1.1 DFD Notation Elements (Yourdon / DeMarco & Gane-Sarson Standards)
- **External Entity**: Square / Rectangle with solid border `[Entity Name]`. Represents external sources or sinks of data (e.g., Customer, Chef, Payment Gateway).
- **Process**: Rounded rectangle or oval `(Process ID & Name)`. Represents transformations of data.
- **Data Store**: Open-ended rectangle or database cylinder `[(Data Store Name)]`. Represents persistent data repositories (PostgreSQL, MongoDB, Redis).
- **Data Flow**: Directed labeled arrow `-->|Data Flow|`. Shows information transfer.

### 1.2 UML Use Case Conventions
- **Actors**: Stick figures or labeled entities representing human or external system roles.
- **Use Cases**: Ovals/Nodes describing functional goals.
- **`<<include>>`**: Mandatory sub-step or required dependency.
- **`<<extend>>`**: Optional extension triggered under conditional business rules.
- **System Boundary**: Outlines the perimeter of the software system.

---

## 2. Data Flow Diagrams (DFD)

### 2.1 Level 0: Context Data Flow Diagram (Top-Level)

> 🖼️ **Rendered Diagram Image**: [View PNG](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/dfd_level_0_context.png) | [View SVG](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/dfd_level_0_context.svg)

![DFD Level 0 Context Diagram](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/dfd_level_0_context.png)

The Level 0 Context Diagram abstracts the entire **Smart Contactless Dining Platform (SCDP / DineFlow)** as a single overarching system process `(0.0)`, highlighting external entities and primary data boundaries.

```mermaid
flowchart TD
    %% External Entities
    CUST["👤 Customer<br/>(Mobile PWA)"]
    CHEF["🍳 Kitchen Staff / Chef<br/>(KDS Station)"]
    WAITER["🚶 Floor Waiter<br/>(Staff Web/App)"]
    CASHIER["💵 Cashier<br/>(Terminal)"]
    ADMIN["📊 Restaurant Admin<br/>(Admin Portal)"]
    GATEWAY["💳 Payment Gateway<br/>(Razorpay / Stripe)"]

    %% Core Central Process
    SYSTEM(("0.0<br/>Smart Contactless<br/>Dining Platform<br/>(SCDP / DineFlow)"))

    %% Customer Flows
    CUST -->|1. Table QR Scan & Session Init Request| SYSTEM
    CUST -->|2. Cart Item Selections & Modifiers| SYSTEM
    CUST -->|3. Order Submission & Kitchen Notes| SYSTEM
    CUST -->|4. Payment Request & Method Selection| SYSTEM
    CUST -->|5. Service Calls & Feedback Rating| SYSTEM
    SYSTEM -->|A. Digital Menu & Live Pricing| CUST
    SYSTEM -->|B. Order Status & Real-time Cooking Updates| CUST
    SYSTEM -->|C. Digital GST Invoice & Receipt| CUST

    %% Kitchen Flows
    SYSTEM -->|D. Real-time Kitchen Order Tickets - KOT| CHEF
    CHEF -->|6. Stage Transitions - Preparing or Ready| CHEF_FLOW[Stage Flow]
    CHEF_FLOW -.-> CHEF
    CHEF -->|6. Status Updates & Out-of-Stock Flags| SYSTEM

    %% Waiter Flows
    SYSTEM -->|E. Assistance Alerts & Ready-to-Serve Notifications| WAITER
    WAITER -->|7. Table Service Confirmations & Cash Collection| SYSTEM

    %% Cashier Flows
    SYSTEM -->|F. Pending Table Bills & Session Summaries| CASHIER
    CASHIER -->|8. Offline Cash Payment Settlement & Session Close| SYSTEM

    %% Admin Flows
    ADMIN -->|9. Menu CRUD, Stock Levels & Table QR Config| SYSTEM
    SYSTEM -->|G. Real-time Sales, Revenue & KDS Analytics| ADMIN

    %% External Payment Gateway Flows
    SYSTEM -->|10. Create Payment Order Intent| GATEWAY
    GATEWAY -->|H. Webhook Verification & Payment Settlement| SYSTEM

    %% Styling
    classDef entity fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef process fill:#0284c7,stroke:#bae6fd,stroke-width:3px,color:#ffffff,font-weight:bold;
    classDef invisible fill:none,stroke:none,color:none;
    
    class CUST,CHEF,WAITER,CASHIER,ADMIN,GATEWAY entity;
    class SYSTEM process;
    class CHEF_FLOW invisible;
```

---

### 2.2 Level 1: Subsystem Data Flow Diagram (Middle-Level)

> 🖼️ **Rendered Diagram Image**: [View PNG](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/dfd_level_1_subsystem.png) | [View SVG](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/dfd_level_1_subsystem.svg)

![DFD Level 1 Subsystem Diagram](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/dfd_level_1_subsystem.png)

The Level 1 DFD decomposes the system into **7 core business processes**, showing major data stores and inter-process data exchanges.

```mermaid
flowchart TB
    %% External Entities
    subgraph Entities ["External Entities"]
        CUST["👤 Customer"]
        CHEF["🍳 Kitchen Chef"]
        WAITER["🚶 Waiter"]
        CASHIER["💵 Cashier"]
        ADMIN["📊 Restaurant Admin"]
        GATEWAY["💳 Payment Gateway"]
    end

    %% Data Stores
    subgraph DataStores ["Data Stores (Polyglot Persistence Layer)"]
        DS_AUTH[("D1: Auth & Table Session Store<br/>[PostgreSQL & Redis]")]
        DS_MENU[("D2: Menu & Modifiers Catalog<br/>[MongoDB]")]
        DS_ORDERS[("D3: Orders & OrderItems Store<br/>[PostgreSQL]")]
        DS_PAYMENT[("D4: Payments & Invoices Store<br/>[PostgreSQL]")]
        DS_INVENTORY[("D5: Inventory & Raw Stock Store<br/>[PostgreSQL]")]
        DS_EVENTS[("D6: Live Event Broker / Pub-Sub<br/>[Redis Pub/Sub]")]
    end

    %% Core Level 1 Processes
    subgraph Processes ["Level 1 Core Processes"]
        P1("1.0<br/>Session & Table Authentication")
        P2("2.0<br/>Menu Catalog & Dietary Browsing")
        P3("3.0<br/>Cart & Order Placement")
        P4("4.0<br/>Kitchen Queue & KDS Routing")
        P5("5.0<br/>Payment Processing & Invoicing")
        P6("6.0<br/>Service Assistance & Waiter Call")
        P7("7.0<br/>Admin Management & Inventory Control")
    end

    %% Process 1.0 Flows
    CUST -->|Table QR Payload| P1
    P1 <-->|Validate & Cache Active Session Token| DS_AUTH
    P1 -->|Active Session Context| P2
    P1 -->|Validated Session ID| P3

    %% Process 2.0 Flows
    DS_MENU -->|Active Categories, Items & Modifiers| P2
    P2 -->|Interactive Digital Menu| CUST
    P7 -->|Menu Item Updates & Stock Status| DS_MENU

    %% Process 3.0 Flows
    CUST -->|Selected Items, Modifiers & Notes| P3
    P3 -->|Validate Prices & Dietary Tags| DS_MENU
    P3 -->|Write New Order Record| DS_ORDERS
    P3 -->|Reserve Ingredients| DS_INVENTORY
    P3 -->|Emit Order Created Event| DS_EVENTS
    P3 -->|Order Summary & Bill Amount| P5

    %% Process 4.0 Flows
    DS_EVENTS -->|Listen New Order Event| P4
    P4 <-->|Fetch/Update Order Status| DS_ORDERS
    P4 -->|Push Digital KOT to Station| CHEF
    CHEF -->|Update Prep State (Cooking/Ready)| P4
    P4 -->|Publish Prep Progress Update| DS_EVENTS
    DS_EVENTS -->|Stream Live Progress Update| CUST
    P4 -->|Dish Ready Notification| P6

    %% Process 5.0 Flows
    CUST -->|Initiate Checkout| P5
    P5 <-->|Create Transaction & Verify Signature| GATEWAY
    CASHIER -->|Record Cash Settlement| P5
    P5 -->|Record Completed Transaction| DS_PAYMENT
    P5 -->|Update Order Payment Status (PAID)| DS_ORDERS
    P5 -->|Release Table Session| DS_AUTH
    P5 -->|Itemized Digital Invoice| CUST

    %% Process 6.0 Flows
    CUST -->|Assistance Request (Water/Bill)| P6
    P6 -->|Publish Table Service Alert| DS_EVENTS
    DS_EVENTS -->|Deliver Notification Badge| WAITER
    WAITER -->|Acknowledge Service & Served Status| P6
    P6 -->|Update Order Status to SERVED| DS_ORDERS

    %% Process 7.0 Flows
    ADMIN -->|Stock Adjustments & Low Thresholds| P7
    P7 <-->|Ingredient Depletion & Restock Data| DS_INVENTORY
    DS_ORDERS -->|Sales & Fulfillment Reports| P7
    DS_PAYMENT -->|Financial Logs| P7
    P7 -->|Analytical Dashboard Metrics| ADMIN

    %% Styling
    classDef pStyle fill:#0369a1,stroke:#38bdf8,stroke-width:2px,color:#ffffff,font-weight:600;
    classDef dsStyle fill:#0f172a,stroke:#34d399,stroke-width:2px,color:#6ee7b7,font-family:monospace;
    classDef entStyle fill:#1e293b,stroke:#f59e0b,stroke-width:2px,color:#ffffff;

    class P1,P2,P3,P4,P5,P6,P7 pStyle;
    class DS_AUTH,DS_MENU,DS_ORDERS,DS_PAYMENT,DS_INVENTORY,DS_EVENTS dsStyle;
    class CUST,CHEF,WAITER,CASHIER,ADMIN,GATEWAY entStyle;
```

---

### 2.3 Level 2: Detailed Data Flow Diagrams (Lower-Level)

#### 2.3.1 DFD 2.0 - Order Processing & Validation Subsystem

> 🖼️ **Rendered Diagram Image**: [View PNG](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/dfd_level_2_order_placement.png) | [View SVG](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/dfd_level_2_order_placement.svg)

![DFD Level 2 Order Placement](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/dfd_level_2_order_placement.png)

Decomposing **Process 3.0 (Cart & Order Placement)** into detailed atomic steps.

```mermaid
flowchart TD
    %% Entities & Stores
    CUST["👤 Customer App"]
    DS_AUTH[("D1: Table Session Store")]
    DS_MENU[("D2: Menu Catalog")]
    DS_ORDERS[("D3: Orders Store")]
    DS_INVENTORY[("D5: Inventory Store")]
    DS_EVENTS[("D6: Redis Pub/Sub")]

    %% Process Decomposition
    P31("3.1<br/>Validate Session & Cart Items")
    P32("3.2<br/>Verify Stock & Ingredient Availability")
    P33("3.3<br/>Calculate Subtotal, Tax & Discounts")
    P34("3.4<br/>Persist Order & OrderItems")
    P35("3.5<br/>Deduct Raw Ingredients")
    P36("3.6<br/>Dispatch Order Event to Message Broker")

    %% Data Flow
    CUST -->|Order Payload (TableID, Items, Modifiers)| P31
    P31 -->|Verify Table Session Token| DS_AUTH
    DS_AUTH -->|Token Validated| P31
    P31 -->|Verify Item IDs & Price Integrity| DS_MENU
    DS_MENU -->|Item Details Confirmed| P31
    P31 -->|Validated Cart| P32

    P32 -->|Check Real-time Stock Levels| DS_INVENTORY
    DS_INVENTORY -->|Stock Available| P32
    P32 -->|In-Stock Item List| P33
    P32 -.->|"Reject: Out of Stock Error"| CUST

    P33 -->|Pricing Breakdown: Subtotal + GST - Discount| P34
    P34 -->|"Write Records: Order (PENDING)"| DS_ORDERS
    P34 -->|Order Confirmation & ID| P35
    P34 -->|Return Order ID & Final Bill to Client| CUST

    P35 -->|Decrement Stock Quantities| DS_INVENTORY
    P35 -->|Completed Order Object| P36

    P36 -->|Publish Topic: /topic/kitchen/new-orders| DS_EVENTS

    %% Styling
    classDef proc fill:#0284c7,stroke:#e0f2fe,stroke-width:2px,color:#ffffff;
    classDef store fill:#0f172a,stroke:#10b981,stroke-width:2px,color:#6ee7b7;
    classDef ent fill:#1e293b,stroke:#f59e0b,stroke-width:2px,color:#ffffff;
    class P31,P32,P33,P34,P35,P36 proc;
    class DS_AUTH,DS_MENU,DS_ORDERS,DS_INVENTORY,DS_EVENTS store;
    class CUST ent;
```

---

#### 2.3.2 DFD 3.0 - Kitchen Routing & KDS Workflow Subsystem

> 🖼️ **Rendered Diagram Image**: [View PNG](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/dfd_level_2_kitchen_kds.png) | [View SVG](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/dfd_level_2_kitchen_kds.svg)

![DFD Level 2 Kitchen KDS](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/dfd_level_2_kitchen_kds.png)

Decomposing **Process 4.0 (Kitchen Queue & KDS Routing)** with skill-based chef assignment and stage management.

```mermaid
flowchart TD
    %% Entities & Stores
    CHEF["🍳 Kitchen Chef Station"]
    DS_ORDERS[("D3: Orders Store")]
    DS_EVENTS[("D6: Redis Pub/Sub")]
    DS_STAFF[("D1: Staff Workload Store")]

    %% Detailed Sub-processes
    P41("4.1<br/>Consume Order Event & Parse KOT")
    P42("4.2<br/>Skill-Aware Station & Chef Routing")
    P43("4.3<br/>Display KDS Card with Dynamic EPT")
    P44("4.4<br/>Process Chef Stage Transition")
    P45("4.5<br/>Broadcast Real-time Status Event")

    %% Data Flow
    DS_EVENTS -->|Receive: New Order Event| P41
    P41 -->|Item Category, Cooking Priority & Notes| P42

    P42 -->|Query Chef Stations & Workload| DS_STAFF
    DS_STAFF -->|Available Chef Selected| P42
    P42 -->|Assigned Station KOT Ticket| P43

    P43 -->|Render Color-Coded KOT on Screen| CHEF
    CHEF -->|Action: Accept Order| P44
    CHEF -->|Action: Stage Transition (PREPARING -> COOKING -> READY)| P44

    P44 -->|Update Status & Timestamps| DS_ORDERS
    P44 -->|Stage Change Payload| P45

    P45 -->|Publish: /topic/table/tableId/order-updates| DS_EVENTS
    P45 -->|When READY: Publish /topic/waiter/alerts| DS_EVENTS

    %% Styling
    classDef proc fill:#0284c7,stroke:#e0f2fe,stroke-width:2px,color:#ffffff;
    classDef store fill:#0f172a,stroke:#10b981,stroke-width:2px,color:#6ee7b7;
    classDef ent fill:#1e293b,stroke:#f59e0b,stroke-width:2px,color:#ffffff;
    class P41,P42,P43,P44,P45 proc;
    class DS_ORDERS,DS_EVENTS,DS_STAFF store;
    class CHEF ent;
```

---

#### 2.3.3 DFD 4.0 - Payment Processing & Digital Invoicing Subsystem

> 🖼️ **Rendered Diagram Image**: [View PNG](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/dfd_level_2_payment_invoicing.png) | [View SVG](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/dfd_level_2_payment_invoicing.svg)

![DFD Level 2 Payment and Invoicing](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/dfd_level_2_payment_invoicing.png)

Decomposing **Process 5.0 (Payment Processing & Invoicing)** for online and counter settlements.

```mermaid
flowchart TD
    %% Entities & Stores
    CUST["👤 Customer"]
    CASHIER["💵 Cashier"]
    GATEWAY["💳 Payment Gateway (Razorpay/Stripe)"]
    DS_ORDERS[("D3: Orders Store")]
    DS_PAYMENT[("D4: Payments & Invoices Store")]
    DS_AUTH[("D1: Session Store")]
    DS_EVENTS[("D6: Redis Pub/Sub")]

    %% Processes
    P51("5.1<br/>Select Payment Channel")
    P52("5.2<br/>Create Gateway Order & Signature Token")
    P53("5.3<br/>Verify Webhook / Cryptographic Signature")
    P54("5.4<br/>Process Counter Cash Receipt")
    P55("5.5<br/>Update Order Status & Settle Ledger")
    P56("5.6<br/>Generate Itemized GST PDF Invoice")
    P57("5.7<br/>Release Table Session & Close Order")

    %% Flows
    CUST -->|Checkout Choice: Online or Cash| P51

    %% Online branch
    P51 -->|Online Payment Selected| P52
    P52 <-->|Create Payment Intent| GATEWAY
    P52 -->|Gateway Order Credentials| CUST
    CUST -->|Complete UPI / Card Payment| GATEWAY
    GATEWAY -->|Webhook Notification & Signature| P53
    P53 -->|Validated Online Transaction| P55

    %% Cash branch
    P51 -->|Pay at Counter Selected| P54
    CASHIER -->|Confirm Cash Received & Authenticate| P54
    P54 -->|Cash Transaction Record| P55

    %% Persistence & Invoicing
    P55 -->|Write Payment Record (Method, TxnID, Status: PAID)| DS_PAYMENT
    P55 -->|Update Order Payment State to PAID| DS_ORDERS
    P55 -->|Trigger Invoice Generation| P56

    P56 -->|Generate GST Compliant Digital Receipt| DS_PAYMENT
    P56 -->|Deliver PDF Invoice URL / WhatsApp Link| CUST
    P56 -->|Trigger Session Release| P57

    P57 -->|Mark Session COMPLETED / Reset Table| DS_AUTH
    P57 -->|Publish Table Reset Event| DS_EVENTS

    %% Styling
    classDef proc fill:#0284c7,stroke:#e0f2fe,stroke-width:2px,color:#ffffff;
    classDef store fill:#0f172a,stroke:#10b981,stroke-width:2px,color:#6ee7b7;
    classDef ent fill:#1e293b,stroke:#f59e0b,stroke-width:2px,color:#ffffff;
    class P51,P52,P53,P54,P55,P56,P57 proc;
    class DS_ORDERS,DS_PAYMENT,DS_AUTH,DS_EVENTS store;
    class CUST,CASHIER,GATEWAY ent;
```

---

#### 2.3.4 DFD 5.0 - Inventory Tracking & Depletion Subsystem

> 🖼️ **Rendered Diagram Image**: [View PNG](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/dfd_level_2_inventory_tracking.png) | [View SVG](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/dfd_level_2_inventory_tracking.svg)

![DFD Level 2 Inventory Tracking](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/dfd_level_2_inventory_tracking.png)

Decomposing **Process 7.0 Inventory Sub-processes** showing recipe tracking, ingredient depletion, and automated threshold alerts.

```mermaid
flowchart TD
    %% Entities & Stores
    ADMIN["📊 Restaurant Admin"]
    DS_ORDERS[("D3: Orders Store")]
    DS_RECIPE[("D2: Recipe & BOM Store")]
    DS_INVENTORY[("D5: Inventory & Raw Stock Store")]
    NOTIFICATION["🔔 Admin Notification System"]

    %% Processes
    P71("7.1<br/>Map Order Items to Recipe Ingredients")
    P72("7.2<br/>Calculate Raw Material Consumption")
    P73("7.3<br/>Update Stock Balance in Real-Time")
    P74("7.4<br/>Evaluate Low-Stock Thresholds")
    P75("7.5<br/>Trigger Restock Alert & Auto-Disable Item")

    %% Flows
    DS_ORDERS -->|Completed/In-Prep Order Items| P71
    P71 <-->|Fetch Recipe Bill of Materials (BOM)| DS_RECIPE
    P71 -->|Ingredient Units Required| P72

    P72 -->|Computed Deductions (e.g., -200g Cheese)| P73
    P73 <-->|Update Stock Balance| DS_INVENTORY
    P73 -->|New Current Stock Levels| P74

    P74 -->|Compare Against Minimum Safety Stock| P74
    P74 -->|Threshold Breached: Stock <= MinStock| P75
    P74 -->|Stock Adequate| DS_INVENTORY

    P75 -->|Dispatch Critical Low-Stock Warning| NOTIFICATION
    NOTIFICATION -->|Push Alert & Email Summary| ADMIN
    P75 -->|Set Item is_available = FALSE| DS_RECIPE
    ADMIN -->|Restock Order & Record Inflow| DS_INVENTORY

    %% Styling
    classDef proc fill:#0284c7,stroke:#e0f2fe,stroke-width:2px,color:#ffffff;
    classDef store fill:#0f172a,stroke:#10b981,stroke-width:2px,color:#6ee7b7;
    classDef ent fill:#1e293b,stroke:#f59e0b,stroke-width:2px,color:#ffffff;
    class P71,P72,P73,P74,P75 proc;
    class DS_ORDERS,DS_RECIPE,DS_INVENTORY store;
    class ADMIN,NOTIFICATION ent;
```

---

## 3. DFD Data Dictionary

| Data Flow / Element | Source | Destination | Data Composition & Types |
| :--- | :--- | :--- | :--- |
| `Table_QR_Scan_Payload` | Customer Mobile | Process 1.0 (Auth) | `{ tableId: UUID, token: String, timestamp: DateTime }` |
| `Session_Context` | Process 1.0 | Data Store D1 | `{ sessionId: UUID, tableNumber: Integer, status: Enum("ACTIVE","COMPLETED"), jwtToken: String }` |
| `Menu_Catalog_Response` | Data Store D2 | Customer Mobile | `{ categories: Array<{ id: UUID, name: String, items: Array<MenuItem> }> }` |
| `Order_Submission_Payload`| Customer Mobile | Process 3.0 | `{ sessionId: UUID, items: Array<{ itemId: UUID, variantId: UUID, modifiers: Array<UUID>, qty: Int, notes: String }> }` |
| `Kitchen_Order_Ticket (KOT)`| Process 4.0 | Kitchen Display | `{ orderId: UUID, orderNum: String, tableNum: Int, items: Array<ItemSummary>, eptMinutes: Int, status: Enum }` |
| `Status_Update_Event` | Chef Station | Redis Pub/Sub | `{ orderId: UUID, newStatus: Enum("PREPARING","COOKING","READY","SERVED"), updatedBy: UUID }` |
| `Payment_Intent_Payload`| Process 5.0 | Payment Gateway | `{ orderId: UUID, amount: Decimal, currency: "INR", customerPhone: String, customerEmail: String }` |
| `Digital_Invoice_Data` | Process 5.0 | Data Store D4 | `{ invoiceId: UUID, gstNumber: String, subtotal: Decimal, cgst: Decimal, sgst: Decimal, total: Decimal, pdfUrl: String }` |
| `Assistance_Alert` | Customer Mobile | Waiter Mobile | `{ tableId: UUID, tableNum: Int, requestType: Enum("WATER","CUTLERY","BILL","STAFF"), timestamp: DateTime }` |
| `Low_Stock_Alert` | Process 7.0 | Admin Dashboard | `{ ingredientId: UUID, name: String, currentQty: Float, thresholdQty: Float, unit: String }` |

---

## 4. Use Case Diagrams

### 4.1 Complete System-Wide Use Case Diagram

> 🖼️ **Rendered Diagram Image**: [View PNG](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/usecase_complete_system.png) | [View SVG](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/usecase_complete_system.svg)

![System-Wide Use Case Diagram](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/usecase_complete_system.png)

This comprehensive diagram maps all primary actors (`Customer`, `Kitchen Chef`, `Floor Waiter`, `Cashier`, `Restaurant Admin`, and `Super Admin`), alongside the external `Payment Gateway`, across the complete DineFlow ecosystem.

```mermaid
flowchart LR
    %% Actors
    subgraph Actors ["System Actors"]
        direction TB
        C["👤 Customer (Guest)"]
        K["🍳 Kitchen Staff / Chef"]
        W["🚶 Floor Waiter"]
        CS["💵 Cashier"]
        A["📊 Restaurant Admin"]
        SA["🌐 Super Admin"]
        PG["💳 Payment Gateway (Ext)"]
    end

    %% Use Cases Boundary
    subgraph SystemBoundary ["Smart Contactless Dining Platform (SCDP)"]
        direction TB

        %% Customer Use Cases
        subgraph UC_Customer ["Dining & Ordering Core"]
            UC1(("Scan QR & Init Session"))
            UC2(("Browse Menu & Filter Diets"))
            UC3(("Customize Item & Modifiers"))
            UC4(("Manage Cart & Checkout"))
            UC5(("Place Order"))
            UC6(("Track Real-Time Order Status"))
            UC7(("Call Waiter / Assistance"))
            UC8(("Pay Online via Gateway"))
            UC9(("Pay Cash at Counter"))
            UC10(("Download Digital Invoice"))
            UC11(("Submit Food & Service Review"))
        end

        %% Kitchen Use Cases
        subgraph UC_Kitchen ["Kitchen Operations (KDS)"]
            UC12(("View Live KDS Order Queue"))
            UC13(("Accept / Reject Order"))
            UC14(("Update Cooking Stage"))
            UC15(("Toggle Item Stock Out"))
            UC16(("View Estimated Prep Time - EPT"))
        end

        %% Waiter & Cashier Use Cases
        subgraph UC_Floor ["Floor & Billing Operations"]
            UC17(("Receive Waiter Assistance Alert"))
            UC18(("Mark Order as Served"))
            UC19(("Collect Cash Bill"))
            UC20(("Print Duplicate Receipt"))
            UC21(("Close Table Session"))
        end

        %% Admin & Super Admin Use Cases
        subgraph UC_Admin ["Management & Governance"]
            UC22(("Manage Menu Items & Prices"))
            UC23(("Track Raw Ingredient Inventory"))
            UC24(("Generate Table QR Codes"))
            UC25(("View Live Sales & Metrics Analytics"))
            UC26(("Manage Staff Accounts & RBAC"))
            UC27(("Configure Multi-Branch Outlets"))
        end
    end

    %% Actor Relationships
    C --> UC1
    C --> UC2
    C --> UC3
    C --> UC4
    C --> UC5
    C --> UC6
    C --> UC7
    C --> UC8
    C --> UC9
    C --> UC10
    C --> UC11

    K --> UC12
    K --> UC13
    K --> UC14
    K --> UC15
    K --> UC16

    W --> UC17
    W --> UC18
    W --> UC19

    CS --> UC19
    CS --> UC20
    CS --> UC21

    A --> UC22
    A --> UC23
    A --> UC24
    A --> UC25
    A --> UC26

    SA --> UC26
    SA --> UC27

    %% External Systems
    UC8 <--> PG

    %% Includes and Extends
    UC5 -.->|<<include>>| UC1
    UC4 -.->|<<include>>| UC3
    UC5 -.->|<<include>>| UC4
    UC8 -.->|<<extend>>| UC5
    UC9 -.->|<<extend>>| UC5
    UC10 -.->|<<include>>| UC8
    UC10 -.->|<<include>>| UC9
    UC14 -.->|<<include>>| UC12
    UC18 -.->|<<include>>| UC14
    UC21 -.->|<<include>>| UC19

    %% Styling
    classDef actorStyle fill:#1e293b,stroke:#0284c7,stroke-width:2px,color:#f8fafc;
    classDef ucStyle fill:#f0fdf4,stroke:#16a34a,stroke-width:1.5px,color:#14532d;
    classDef extStyle fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#78350f;

    class C,K,W,CS,A,SA actorStyle;
    class PG extStyle;
    class UC1,UC2,UC3,UC4,UC5,UC6,UC7,UC8,UC9,UC10,UC11,UC12,UC13,UC14,UC15,UC16,UC17,UC18,UC19,UC20,UC21,UC22,UC23,UC24,UC25,UC26,UC27 ucStyle;
```

---

### 4.2 Customer Self-Ordering & Dining Subsystem

> 🖼️ **Rendered Diagram Image**: [View PNG](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/usecase_customer_subsystem.png) | [View SVG](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/usecase_customer_subsystem.svg)

![Customer Subsystem Use Case](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/usecase_customer_subsystem.png)

Detailed decomposition of customer-facing use cases with standard UML `<<include>>` and `<<extend>>` dependencies.

```mermaid
flowchart TB
    CUST["👤 Customer"]

    subgraph "Customer Subsystem Use Cases"
        UC_SCAN(("Scan Table QR Code"))
        UC_AUTH(("Validate Session Token"))
        UC_BROWSE(("Browse Menu Catalog"))
        UC_FILTER(("Filter by Dietary & Allergens"))
        UC_AI_REC(("Get AI Item Recommendations"))
        UC_CUSTOMIZE(("Select Size, Modifiers & Add-ons"))
        UC_CART(("Review Shopping Cart"))
        UC_PLACE(("Place Food Order"))
        UC_PAY_ONLINE(("Pay via UPI / Card"))
        UC_PAY_CASH(("Select Pay at Counter"))
        UC_SPLIT(("Split Bill Among Guests"))
        UC_STATUS(("Track Live Cooking Status"))
        UC_CALL(("Call Waiter / Request Service"))
        UC_INVOICE(("Download GST Invoice PDF"))
        UC_REVIEW(("Submit Food Rating & Feedback"))
    end

    GATEWAY["💳 Payment Gateway"]

    CUST --> UC_SCAN
    CUST --> UC_BROWSE
    CUST --> UC_CART
    CUST --> UC_PLACE
    CUST --> UC_STATUS
    CUST --> UC_CALL
    CUST --> UC_INVOICE
    CUST --> UC_REVIEW

    %% Dependencies
    UC_SCAN -.->|<<include>>| UC_AUTH
    UC_BROWSE -.->|<<extend>>| UC_FILTER
    UC_BROWSE -.->|<<extend>>| UC_AI_REC
    UC_CART -.->|<<include>>| UC_CUSTOMIZE
    UC_PLACE -.->|<<include>>| UC_CART
    UC_PLACE -.->|<<include>>| UC_AUTH

    UC_PAY_ONLINE -.->|<<extend>>| UC_PLACE
    UC_PAY_CASH -.->|<<extend>>| UC_PLACE
    UC_SPLIT -.->|<<extend>>| UC_PAY_ONLINE

    UC_PAY_ONLINE <---> GATEWAY
    UC_INVOICE -.->|<<include>>| UC_PAY_ONLINE
    UC_INVOICE -.->|<<include>>| UC_PAY_CASH

    classDef act fill:#1e293b,stroke:#0284c7,stroke-width:2px,color:#ffffff;
    classDef uc fill:#ecfdf5,stroke:#059669,stroke-width:1.5px,color:#064e3b;
    classDef ext fill:#fffbeb,stroke:#d97706,stroke-width:2px,color:#78350f;

    class CUST act;
    class GATEWAY ext;
    class UC_SCAN,UC_AUTH,UC_BROWSE,UC_FILTER,UC_AI_REC,UC_CUSTOMIZE,UC_CART,UC_PLACE,UC_PAY_ONLINE,UC_PAY_CASH,UC_SPLIT,UC_STATUS,UC_CALL,UC_INVOICE,UC_REVIEW uc;
```

---

### 4.3 Kitchen Display System (KDS) & Chef Operations

> 🖼️ **Rendered Diagram Image**: [View PNG](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/usecase_kitchen_subsystem.png) | [View SVG](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/usecase_kitchen_subsystem.svg)

![Kitchen KDS Use Case](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/usecase_kitchen_subsystem.png)

Detailed use case mapping for kitchen personnel, prep stations, and real-time state management.

```mermaid
flowchart TB
    CHEF["🍳 Kitchen Staff / Chef"]
    HEAD_CHEF["👨‍🍳 Head Chef / Kitchen Lead"]

    HEAD_CHEF -->|Supervises / Inherits| CHEF

    subgraph "Kitchen Subsystem Use Cases"
        UC_QUEUE(("View Real-time KDS Queue"))
        UC_FILTER_STATION(("Filter Queue by Station\n(Grill, Bakery, Bar)"))
        UC_ACCEPT(("Accept New Order Ticket"))
        UC_REJECT(("Reject Order\n(Out of Ingredients)"))
        UC_STAGE(("Update Order Prep Stage"))
        UC_PREP(("Mark as PREPARING"))
        UC_COOK(("Mark as COOKING"))
        UC_READY(("Mark as READY FOR PICKUP"))
        UC_TOGGLE_STOCK(("Toggle Item Out-of-Stock"))
        UC_REASSIGN(("Reassign Task to Station/Chef"))
        UC_EPT(("Monitor Estimated Prep Timers"))
    end

    CHEF --> UC_QUEUE
    CHEF --> UC_ACCEPT
    CHEF --> UC_STAGE
    CHEF --> UC_TOGGLE_STOCK
    CHEF --> UC_EPT

    HEAD_CHEF --> UC_FILTER_STATION
    HEAD_CHEF --> UC_REJECT
    HEAD_CHEF --> UC_REASSIGN

    %% Generalization & Dependencies
    UC_PREP -->|Prep Stage| UC_STAGE
    UC_COOK -->|Cooking Stage| UC_STAGE
    UC_READY -->|Ready Stage| UC_STAGE

    UC_ACCEPT -.->|<<include>>| UC_QUEUE
    UC_STAGE -.->|<<include>>| UC_ACCEPT
    UC_QUEUE -.->|<<extend>>| UC_EPT

    classDef act fill:#1e293b,stroke:#0284c7,stroke-width:2px,color:#ffffff;
    classDef uc fill:#eff6ff,stroke:#2563eb,stroke-width:1.5px,color:#1e3a8a;

    class CHEF,HEAD_CHEF act;
    class UC_QUEUE,UC_FILTER_STATION,UC_ACCEPT,UC_REJECT,UC_STAGE,UC_PREP,UC_COOK,UC_READY,UC_TOGGLE_STOCK,UC_REASSIGN,UC_EPT uc;
```

---

### 4.4 Waitstaff & Floor Service Operations

> 🖼️ **Rendered Diagram Image**: [View PNG](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/usecase_waitstaff_floor.png) | [View SVG](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/usecase_waitstaff_floor.svg)

![Waitstaff Floor Service Use Case](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/usecase_waitstaff_floor.png)

Use case model for waitstaff floor monitoring, table delivery, and customer call resolution.

```mermaid
flowchart TB
    WAITER["🚶 Floor Waiter"]

    subgraph "Floor Service Subsystem Use Cases"
        UC_LOGIN(("Staff Login & Table Zone Assignment"))
        UC_ALERT(("Receive Call Waiter Alert"))
        UC_ACK_ALERT(("Acknowledge Table Request"))
        UC_READY_ALERT(("Receive Dish Ready Notification"))
        UC_DELIVER(("Serve Food to Table"))
        UC_SERVED(("Mark Order Item as SERVED"))
        UC_COLLECT_CASH(("Collect Cash Payment at Table"))
        UC_ISSUE_RECEIPT(("Deliver Printed Receipt"))
    end

    WAITER --> UC_LOGIN
    WAITER --> UC_ALERT
    WAITER --> UC_ACK_ALERT
    WAITER --> UC_READY_ALERT
    WAITER --> UC_DELIVER
    WAITER --> UC_COLLECT_CASH

    %% Dependencies
    UC_ACK_ALERT -.->|<<include>>| UC_ALERT
    UC_DELIVER -.->|<<include>>| UC_READY_ALERT
    UC_SERVED -.->|<<include>>| UC_DELIVER
    UC_ISSUE_RECEIPT -.->|<<extend>>| UC_COLLECT_CASH

    classDef act fill:#1e293b,stroke:#0284c7,stroke-width:2px,color:#ffffff;
    classDef uc fill:#faf5ff,stroke:#9333ea,stroke-width:1.5px,color:#581c87;

    class WAITER act;
    class UC_LOGIN,UC_ALERT,UC_ACK_ALERT,UC_READY_ALERT,UC_DELIVER,UC_SERVED,UC_COLLECT_CASH,UC_ISSUE_RECEIPT uc;
```

---

### 4.5 Cashier & Billing Settlement

> 🖼️ **Rendered Diagram Image**: [View PNG](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/usecase_cashier_settlement.png) | [View SVG](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/usecase_cashier_settlement.svg)

![Cashier Settlement Use Case](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/usecase_cashier_settlement.png)

Use cases for point-of-sale cashier operators managing bills, manual payments, and table turnover.

```mermaid
flowchart TB
    CASHIER["💵 Restaurant Cashier"]

    subgraph "Cashier & Settlement Subsystem"
        UC_VIEW_BILLS(("View Active Table Billings"))
        UC_APPLY_DISCOUNT(("Apply Manual Manager Discount / Coupon"))
        UC_PROCESS_CASH(("Process Counter Cash Settlement"))
        UC_VERIFY_PAYMENT(("Verify Gateway Transaction Ref"))
        UC_PRINT_RECEIPT(("Print Official Paper Receipt"))
        UC_CLOSE_SESSION(("Close Table Session & Free Table"))
        UC_SPLIT_SETTLE(("Execute Split Payment Settlement"))
    end

    CASHIER --> UC_VIEW_BILLS
    CASHIER --> UC_APPLY_DISCOUNT
    CASHIER --> UC_PROCESS_CASH
    CASHIER --> UC_VERIFY_PAYMENT
    CASHIER --> UC_CLOSE_SESSION

    UC_PROCESS_CASH -.->|<<include>>| UC_VIEW_BILLS
    UC_PRINT_RECEIPT -.->|<<extend>>| UC_PROCESS_CASH
    UC_PRINT_RECEIPT -.->|<<extend>>| UC_VERIFY_PAYMENT
    UC_CLOSE_SESSION -.->|<<include>>| UC_PROCESS_CASH
    UC_CLOSE_SESSION -.->|<<include>>| UC_VERIFY_PAYMENT
    UC_SPLIT_SETTLE -.->|<<extend>>| UC_PROCESS_CASH

    classDef act fill:#1e293b,stroke:#0284c7,stroke-width:2px,color:#ffffff;
    classDef uc fill:#fff7ed,stroke:#ea580c,stroke-width:1.5px,color:#7c2d12;

    class CASHIER act;
    class UC_VIEW_BILLS,UC_APPLY_DISCOUNT,UC_PROCESS_CASH,UC_VERIFY_PAYMENT,UC_PRINT_RECEIPT,UC_CLOSE_SESSION,UC_SPLIT_SETTLE uc;
```

---

### 4.6 Restaurant Management & Administrative Operations

> 🖼️ **Rendered Diagram Image**: [View PNG](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/usecase_admin_governance.png) | [View SVG](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/usecase_admin_governance.svg)

![Admin Governance Use Case](file:///d:/project/Sem-3-MSIT/Project/context/diagrams/images/usecase_admin_governance.png)

Administrative capabilities for store managers and enterprise operators.

```mermaid
flowchart TB
    ADMIN["📊 Restaurant Admin / Manager"]
    SUPER_ADMIN["🌐 Super Admin"]

    SUPER_ADMIN -->|Inherits & Governs| ADMIN

    subgraph "Admin & Governance Subsystem"
        UC_MENU_CRUD(("Manage Menu Items, Variants & Pricing"))
        UC_TOGGLE_AVAIL(("Toggle Live Item Availability"))
        UC_INV_TRACK(("Track Raw Ingredient Stock"))
        UC_INV_RESTOCK(("Log Inward Restock & Suppliers"))
        UC_ALERT_CONFIG(("Configure Low-Stock Alert Limits"))
        UC_QR_GEN(("Generate & Export Table QR Codes - SVG/PNG"))
        UC_STAFF_RBAC(("Manage Staff Accounts & Assign Roles"))
        UC_SALES_ANALYTICS(("View Sales, Revenue & Hourly Peak Reports"))
        UC_KDS_METRICS(("Analyze Average Prep & Turnaround Time"))
        UC_MULTI_BRANCH(("Manage Multi-Branch Outlets & Subscriptions"))
        UC_SIMULATION(("Run What-If Operational Simulation"))
    end

    ADMIN --> UC_MENU_CRUD
    ADMIN --> UC_TOGGLE_AVAIL
    ADMIN --> UC_INV_TRACK
    ADMIN --> UC_INV_RESTOCK
    ADMIN --> UC_ALERT_CONFIG
    ADMIN --> UC_QR_GEN
    ADMIN --> UC_STAFF_RBAC
    ADMIN --> UC_SALES_ANALYTICS
    ADMIN --> UC_KDS_METRICS
    ADMIN --> UC_SIMULATION

    SUPER_ADMIN --> UC_MULTI_BRANCH

    UC_INV_TRACK -.->|<<extend>>| UC_ALERT_CONFIG
    UC_MENU_CRUD -.->|<<include>>| UC_TOGGLE_AVAIL

    classDef act fill:#1e293b,stroke:#0284c7,stroke-width:2px,color:#ffffff;
    classDef uc fill:#f8fafc,stroke:#475569,stroke-width:1.5px,color:#0f172a;

    class ADMIN,SUPER_ADMIN act;
    class UC_MENU_CRUD,UC_TOGGLE_AVAIL,UC_INV_TRACK,UC_INV_RESTOCK,UC_ALERT_CONFIG,UC_QR_GEN,UC_STAFF_RBAC,UC_SALES_ANALYTICS,UC_KDS_METRICS,UC_MULTI_BRANCH,UC_SIMULATION uc;
```

---

## 5. Key Use Case Detailed Specifications

### Use Case UC-01: Submit Food Order & Checkout
| Attribute | Detail |
| :--- | :--- |
| **Use Case ID** | `UC-01` |
| **Use Case Name** | Submit Food Order & Checkout |
| **Primary Actor** | Customer (Guest) |
| **Secondary Actor(s)**| Kitchen Staff, Payment Gateway |
| **Preconditions** | Customer has scanned a valid Table QR code and initialized an active session; items are present in cart. |
| **Trigger** | Customer clicks the **"Confirm & Place Order"** button. |
| **Main Success Scenario (Happy Path)** | 1. Customer reviews cart items, customization modifiers, and dietary notes.<br/>2. Customer chooses payment option (Online UPI/Card or Pay at Counter).<br/>3. System validates table session lock and ensures items are in stock.<br/>4. If Online Payment is chosen: System creates Razorpay order intent; Customer completes payment; Razorpay returns verified signature.<br/>5. System creates order record in database with status `PENDING_KITCHEN`.<br/>6. System decrements ingredient stocks in inventory.<br/>7. System publishes real-time WebSocket event to kitchen queue `/topic/kitchen/new-orders`.<br/>8. Customer UI updates to live order tracking screen displaying order number and initial EPT timer. |
| **Alternative Flows** | **A1: Item Out of Stock During Checkout**: System flags the depleted item, alerts the user, and prompts to remove or substitute the item.<br/>**A2: Payment Failed/Timeout**: System marks transaction as failed, preserves cart, and allows retry or switch to "Pay at Counter".<br/>**A3: Pay at Counter Chosen**: System bypasses online gateway, sets payment status to `PENDING`, and dispatches order directly to kitchen queue. |
| **Postconditions** | Order is persisted in PostgreSQL; active order appears on KDS screen; customer screen tracks preparation status. |

---

### Use Case UC-02: Manage Kitchen Display & Update Order Stages
| Attribute | Detail |
| :--- | :--- |
| **Use Case ID** | `UC-02` |
| **Use Case Name** | Manage Kitchen Display & Update Order Stages |
| **Primary Actor** | Kitchen Staff / Chef |
| **Secondary Actor(s)**| Floor Waiter, Customer |
| **Preconditions** | Chef is logged in to the KDS web terminal assigned to a kitchen prep station. |
| **Trigger** | New order ticket arrives on KDS screen via WebSocket connection. |
| **Main Success Scenario (Happy Path)** | 1. KDS plays audio chime and displays high-priority color-coded order card.<br/>2. Chef clicks **"Accept"**; order status transitions to `ACCEPTED`.<br/>3. Chef starts cooking and clicks **"Start Preparing"**; status transitions to `PREPARING`.<br/>4. Food is prepared, plated, and chef clicks **"Mark Ready"**; status transitions to `READY`.<br/>5. System updates database order state and publishes WebSocket event to `/topic/table/{tableId}/order-updates` and `/topic/waiter/alerts`.<br/>6. Customer screen immediately updates to "Food is Ready! On its way to your table".<br/>7. Waiter device receives pickup alert with table number. |
| **Alternative Flows** | **A1: Kitchen Rejects Order**: If chef notices critical ingredient shortage, clicks "Reject Order" with reason; system cancels order, triggers automatic refund if paid online, and notifies customer and manager. |
| **Postconditions** | Order progresses to ready state; waitstaff notified for pickup; customer real-time tracking updated. |

---

### Use Case UC-03: Settle Bill & Close Table Session
| Attribute | Detail |
| :--- | :--- |
| **Use Case ID** | `UC-03` |
| **Use Case Name** | Settle Bill & Close Table Session |
| **Primary Actor** | Cashier / Floor Waiter |
| **Secondary Actor(s)**| Customer |
| **Preconditions** | All orders for the table session are marked as `SERVED`. |
| **Trigger** | Customer requests bill settlement via app, or cashier inspects table bill at counter. |
| **Main Success Scenario (Happy Path)** | 1. Cashier selects table number on POS terminal to review consolidated order history.<br/>2. If customer paid online: Cashier verifies `PAID` badge and generates final receipt.<br/>3. If customer pays cash: Cashier inputs cash received, system calculates change, and cashier confirms settlement.<br/>4. System records payment transaction with timestamp and cashier ID.<br/>5. System issues GST-compliant PDF invoice link sent via SMS/WhatsApp or printed.<br/>6. Cashier clicks **"Release Table / Close Session"**.<br/>7. Table status reverts to `AVAILABLE` in PostgreSQL; active session token expires in Redis.<br/>8. Customer app displays "Thank you for dining with us! Please leave a review." |
| **Alternative Flows** | **A1: Split Bill Requested**: System divides order items or total amount across separate guest payments and closes session once the balance hits zero. |
| **Postconditions** | Order status marked `COMPLETED`; table session terminated; table ready for new guests. |

---

## 6. Summary Matrix

| Diagram Category | Level | Primary Target Audience | Architectural Focus |
| :--- | :--- | :--- | :--- |
| **DFD Level 0** | Context (Top) | Stakeholders, Project Managers | System boundaries, external actors, high-level data flows. |
| **DFD Level 1** | Subsystems (Mid) | Solution Architects, Lead Engineers | Decomposition into 7 core processes, polyglot databases, event broker. |
| **DFD Level 2** | Micro-Processes (Low)| Backend Developers, API Engineers | Atomic steps in Ordering, KDS, Invoicing, and Inventory depletion. |
| **Use Case System** | High-Level | Product Managers, QA Engineers | Global actor responsibilities and cross-cutting dependencies. |
| **Use Case Subsystems**| Domain-Specific | Frontend & Backend Feature Teams | Detailed user stories, preconditions, happy paths, and error alternatives. |
