# 🤖 Project Context & Development Guidelines

## 📌 Project Overview
- **Project Name**: Smart Contactless Dining Platform (SCDP) / DineFlow
- **Master Specification (SRS)**: [project.spec.md](file:///d:/project/Sem-3-MSIT/Project/context/project.spec.md)
- **Technical Architecture**: [project.architect.md](file:///d:/project/Sem-3-MSIT/Project/context/project.architect.md)
- **Domain**: QR-Code Contactless Dining, Real-Time Kitchen Display System (KDS), Digital Payments & Restaurant Admin.

---

## 🛠️ Technology Stack & Microservices
- **Frontend**: React 18 (Vite, Tailwind CSS, Redux Toolkit) — Customer App, Kitchen KDS, Admin Portal.
- **Gateway & Proxy**: Nginx (Reverse Proxy, Load Balancer, Route Router).
- **Security & Auth Service**: Spring Boot 3.x, Spring Security (JWT), Spring Data JPA (PostgreSQL).
- **CRUD & Business Microservices**: Node.js (Express) — Menu Service, Order Service, Payment Service, Notification Service.
- **Real-Time Layer**: WebSockets (Socket.io / WS) + Redis Pub/Sub.
- **Polyglot Persistence**:
  - **PostgreSQL**: Transactional data (Users, Orders, OrderItems, Payments, Tables).
  - **MongoDB**: Catalog document store (Menu Categories, Items, Variants, Modifiers).
  - **Redis**: Low-latency caching (Menu cache, active sessions) & WebSocket Pub/Sub.
- **Containerization**: Docker & Docker Compose.

---

## 📐 Core Architectural Principles
1. **Microservices Decoupling**:
   - **Auth Service (Spring Boot)**: Handles authentication, JWT issuance, user management.
   - **Menu Service (Node/Express + Mongo + Redis)**: Catalog management and cached responses.
   - **Order Service (Node/Express + Postgres + Redis)**: Order creation, lifecycle management, bill calculation.
   - **Notification Service (Node/Express + WS)**: Real-time KDS order cards and customer status updates.
   - **Payment Service (Node/Express)**: Razorpay/Stripe integration and PDF invoice generation.
2. **Order Lifecycle State Machine**:
   - `DRAFT` ➔ `SUBMITTED` ➔ `PAYMENT_PENDING` / `PENDING_KITCHEN` ➔ `ACCEPTED` ➔ `PREPARING` ➔ `READY` ➔ `SERVED` ➔ `COMPLETED`.
3. **Data Isolation**:
   - PostgreSQL for transactional consistency (ACID).
   - MongoDB for dynamic schema (menu modifiers & variants).

---

## 📁 Workspace Layout
```
.
├── .agents/
│   └── AGENTS.md               # AI agent rules & persistent context
├── context/
│   ├── project.spec.md         # Master System Specification (SRS)
│   └── project.architect.md    # Technical Architecture & Microservices
└── README.md                   # Developer onboarding & project overview
```
