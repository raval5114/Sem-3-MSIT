# 🍽️ Smart Contactless Dining Platform (SCDP) — DineFlow

> A modern, microservices-based digital restaurant ecosystem providing QR-code self-ordering, real-time Kitchen Display System (KDS), digital billing, and unified restaurant administration.

---

## 📖 Quick Links & Documentation

- 📋 **[Full Specification Document (SRS)](file:///d:/project/Sem-3-MSIT/Project/context/project.spec.md)**
- 🏗️ **[Microservices Architecture Specification](file:///d:/project/Sem-3-MSIT/Project/context/project.architect.md)**
- 📅 **[Development Timeline & Gantt Chart](file:///d:/project/Sem-3-MSIT/Project/context/timeline.md)**
- 🤖 **[Workspace AI Guidelines](file:///d:/project/Sem-3-MSIT/Project/.agents/AGENTS.md)**

---

## 🛠️ Technology Stack Architecture

- ⚛️ **Frontend**: React 18 (Vite, Tailwind CSS, Redux Toolkit)
- 🛡️ **Auth & Security**: Java Spring Boot 3.x, Spring Security (JWT), PostgreSQL
- ⚡ **Core Services**: Node.js / Express.js Microservices (Menu, Order, Payment, Notification)
- 🗄️ **Polyglot Persistence**: PostgreSQL (Transactional) & MongoDB (Catalog)
- 🔴 **Cache & Messaging**: Redis (Caching & Pub/Sub)
- 🌐 **Gateway & Proxy**: Nginx (Reverse Proxy & Load Balancer)
- 🐳 **Containerization**: Docker & Docker Compose

---

## 🏗️ Architecture Overview

```
React Client Apps (Customer / KDS / Admin)
                 │
                 ▼
       Nginx Reverse Proxy & Gateway
                 │
  ┌──────────────┼──────────────┬──────────────┬──────────────┐
  ▼              ▼              ▼              ▼              ▼
Auth Svc     Menu Svc       Order Svc     Payment Svc    Notif Svc (WS)
(Spring)     (Node/Mongo)   (Node/PG)     (Node/PG)      (Node/Redis)
```

For complete technical specifications, database schemas, API endpoint definitions, Nginx config, timeline charts, and Docker Compose setup, refer to **[context/project.architect.md](file:///d:/project/Sem-3-MSIT/Project/context/project.architect.md)** and **[context/timeline.md](file:///d:/project/Sem-3-MSIT/Project/context/timeline.md)**.
