# 🍽️ Smart Contactless Dining Platform (SCDP) — DineFlow

> A modern, microservices-based digital restaurant ecosystem providing QR-code self-ordering, real-time Kitchen Display System (KDS), digital billing, and unified restaurant administration.

---

# 📖 Documentation

- 📋 **Full Specification (SRS):** `context/project.spec.md`
- 🏗️ **Architecture Specification:** `context/project.architect.md`
- 🤖 **Workspace AI Guidelines:** `.agents/AGENTS.md`

---

# 🚀 Technology Stack

| Layer | Technology |
|--------|------------|
| 🎨 Frontend | React 18 (Vite), Tailwind CSS, Redux Toolkit |
| 🔐 Authentication | Spring Boot 3.x, Spring Security, JWT |
| ⚙️ Backend Services | Node.js, Express.js |
| 🗄️ Databases | PostgreSQL, MongoDB |
| ⚡ Cache & Messaging | Redis |
| 🌐 API Gateway | Nginx |
| 🐳 Containerization | Docker, Docker Compose |

---

# 🏗️ System Architecture

```text
                              🍽️ Smart Contactless Dining Platform
                                         (DineFlow)

┌─────────────────────────────────────────────────────────────────────────────┐
│                           Client Applications                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ 📱 Customer Web App │ 👨‍🍳 Kitchen Display │ 🛠️ Admin Dashboard │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ HTTPS / REST / WebSocket
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    🌐 Nginx Reverse Proxy & API Gateway                     │
│           Routing • Load Balancing • SSL • Request Forwarding              │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
      ┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
      ▼              ▼              ▼              ▼              ▼

┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ 🔐 Auth     │ │ 📋 Menu     │ │ 🛒 Order    │ │ 💳 Payment  │ │ 🔔 Notify   │
│ Service     │ │ Service     │ │ Service     │ │ Service     │ │ Service     │
│ SpringBoot  │ │ Node.js     │ │ Node.js     │ │ Node.js     │ │ Node.js     │
│ JWT + PG    │ │ Express     │ │ Express     │ │ Express     │ │ WebSocket   │
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
       │               │               │               │               │
       ▼               ▼               ▼               ▼               ▼

┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ PostgreSQL  │ │ MongoDB     │ │ PostgreSQL  │ │ PostgreSQL  │ │ Redis       │
│ Users/Auth  │ │ Menu Data   │ │ Orders      │ │ Payments    │ │ Pub/Sub     │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘

───────────────────────────────────────────────────────────────────────────────
                 🐳 Docker • ⚡ Microservices • 🔄 Redis • 🔐 JWT
───────────────────────────────────────────────────────────────────────────────
```

---

# 📦 Microservices

## 🔐 Authentication Service
- User Registration
- Login & Logout
- JWT Authentication
- Role-Based Authorization
- Password Encryption
- Session Validation

---

## 📋 Menu Service
- Menu Categories
- Menu Items
- Item Availability
- Restaurant Catalog
- Image Management
- Search & Filtering

---

## 🛒 Order Service
- QR Code Table Ordering
- Cart Management
- Order Placement
- Order Tracking
- Order Status Updates
- Billing Information

---

## 💳 Payment Service
- Payment Processing
- Invoice Generation
- Transaction History
- Payment Status
- Refund Support

---

## 🔔 Notification Service
- Real-time Kitchen Updates
- Customer Notifications
- WebSocket Events
- Redis Pub/Sub Messaging

---

# 💾 Database Architecture

## PostgreSQL
- Users
- Roles
- Orders
- Payments
- Tables
- Billing

### MongoDB
- Menu Categories
- Menu Items
- Restaurant Information
- Images

### Redis
- Session Cache
- API Cache
- Pub/Sub Messaging
- Live Notifications

---

# 🔄 Application Flow

```text
Customer
   │
   ▼
Scan QR Code
   │
   ▼
Browse Digital Menu
   │
   ▼
Add Items to Cart
   │
   ▼
Place Order
   │
   ▼
Order Service
   │
   ├────────► Kitchen Display System
   │
   ├────────► Payment Service
   │
   └────────► Notification Service
                     │
                     ▼
              Customer Receives Live Updates
```

---

# ✨ Core Features

- 📱 QR Code Based Ordering
- 🍽️ Digital Menu
- 👨‍🍳 Kitchen Display System (KDS)
- 📦 Real-time Order Tracking
- 💳 Digital Billing
- 🔐 Secure JWT Authentication
- 👥 Role-Based Access Control
- 📊 Restaurant Analytics
- 📢 Live Notifications
- 🐳 Docker Deployment
- ⚡ Redis Caching
- 🌐 Nginx Reverse Proxy
- 🔄 Microservices Architecture

---

# 🛠️ Deployment

```
Frontend (React)
        │
        ▼
     Nginx Gateway
        │
        ▼
Docker Compose
        │
        ▼
Microservices
        │
        ▼
PostgreSQL • MongoDB • Redis
```

---

# 📁 Project Structure

```
DineFlow/
│
├── frontend/
│   ├── customer-app/
│   ├── admin-dashboard/
│   └── kitchen-display/
│
├── services/
│   ├── auth-service/
│   ├── menu-service/
│   ├── order-service/
│   ├── payment-service/
│   └── notification-service/
│
├── nginx/
├── docker/
├── context/
├── docs/
└── .agents/
```

---

# 📚 Additional Documentation

| Document | Description |
|----------|-------------|
| `context/project.spec.md` | Software Requirements Specification |
| `context/project.architect.md` | Complete System Architecture |
| `.agents/AGENTS.md` | AI Workspace Guidelines |

---

## © DineFlow

**Smart Contactless Dining Platform (SCDP)**

*A scalable, secure, and modern restaurant management ecosystem powered by Microservices, Spring Boot, Node.js, React, Docker, Redis, MongoDB, and PostgreSQL.*