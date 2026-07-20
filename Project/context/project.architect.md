# 🏗️ Technical Architecture Specification: Smart Contactless Dining Platform (SCDP)

> **Document Version**: 1.0.0  
> **Status**: Approved Architecture  
> **Pattern**: Microservices Architecture with Polyglot Persistence & Containerization  
> **Last Updated**: July 20, 2026  

---

## 1. 📌 Architectural Overview & Principles

The **Smart Contactless Dining Platform (SCDP / DineFlow)** uses a modern, cloud-native **Microservices Architecture**. The system decouples authentication and security enforcement into a robust **Java Spring Boot Security Service**, while leveraging lightweight **Node.js (Express)** microservices for high-throughput CRUD operations, real-time WebSocket communications, catalog management, and order processing.

```
                               ┌───────────────────────────┐
                               │   React Frontend Apps     │
                               │ (Customer / KDS / Admin)  │
                               └─────────────┬─────────────┘
                                             │ HTTP / WSS
                                             ▼
                               ┌───────────────────────────┐
                               │    Nginx Gateway & LB     │
                               └─────────────┬─────────────┘
                                             │
      ┌────────────────────────┬─────────────┼─────────────┬────────────────────────┐
      ▼                        ▼             ▼             ▼                        ▼
┌──────────────┐      ┌────────────────┐ ┌──────────┐ ┌──────────────┐      ┌─────────────────────┐
│ Auth Service │      │  Menu Service  │ │  Order   │ │ Payment Svc  │      │ Notification Svc    │
│(Spring Boot) │      │ (Node/Express) │ │ Service  │ │(Node/Express)│      │(Node/Express + WS)  │
└──────┬───────┘      └───────┬────────┘ └────┬─────┘ └──────┬───────┘      └──────────┬──────────┘
       │                      │               │              │                         │
       ▼                      ▼               ▼              ▼                         ▼
  PostgreSQL               MongoDB        PostgreSQL     PostgreSQL                  Redis
  (Auth DB)              (Catalog DB)     (Order DB)    (Payment DB)               (Pub/Sub)
```

### Key Architectural Pillars
1. **Polyglot Persistence**: PostgreSQL for transactional ACID data; MongoDB for dynamic menu schema; Redis for low-latency session and query caching.
2. **Dedicated Security Gateway**: Spring Boot handles centralized authentication, JWT issuance, rate-limiting, and Role-Based Access Control (RBAC).
3. **Event-Driven Real-Time Synchronization**: Node.js microservices with WebSocket connections synchronized across instances via Redis Pub/Sub.
4. **Containerized Deployment**: Multi-container setup managed via Docker and Docker Compose.

---

## 2. 🛠️ Technology Stack Matrix

| Component | Technology | Primary Role |
| :--- | :--- | :--- |
| **Frontend UI** | **React 18** (Vite / Tailwind CSS / Redux Toolkit / React Query) | Responsive Mobile-first PWA for Customers, Kitchen KDS, & Admin Dashboard. |
| **API Gateway & Proxy** | **Nginx** | Reverse proxy, SSL termination, load balancing, path-based routing, static asset serving. |
| **Auth & Security Service** | **Java 17 / Spring Boot 3.x** (Spring Security, JWT, OAuth2) | Centralized authentication, JWT issuing/verification, user credentials, RBAC enforcement. |
| **Core CRUD Services** | **Node.js v20 / Express.js** | High-performance, event-driven REST APIs for Menu, Orders, Tables, & Payments. |
| **Real-Time Layer** | **Node.js + WebSockets (Socket.io / WS)** | Instant bidirectional messaging for Kitchen KDS order updates and table alerts. |
| **Relational Database** | **PostgreSQL 16** | Transactional database for Users, Orders, OrderItems, Payments, Invoices, and Tables. |
| **Document Database** | **MongoDB 7.0** | Flexible schema document store for Menu Catalog, Categories, Modifiers, and Customer Feedback. |
| **Cache & Pub/Sub** | **Redis 7.2** | Active table session caching, menu response cache, and WebSocket multi-instance Pub/Sub broker. |
| **Containerization** | **Docker & Docker Compose** | Isolated microservices runtime environment and container orchestration. |

---

## 3. 🧩 Microservices Breakdown & Responsibilities

```mermaid
graph TD
    subgraph Clients ["Client Layer (React Apps)"]
        C_APP["📱 Customer App (Mobile Web)"]
        K_APP["🍳 Kitchen KDS (Web App)"]
        A_APP["📊 Admin Portal (Web App)"]
    end

    subgraph Gateway ["Gateway & Proxy Layer"]
        NGINX["🌐 Nginx API Gateway"]
    end

    subgraph Security ["Security & Identity"]
        AUTH_SVC["🛡️ Auth Service (Spring Boot 3.x)\n• JWT Issuance & Verification\n• User & Role Management\n• Token Validation"]
    end

    subgraph CoreServices ["Express Microservices"]
        MENU_SVC["📖 Menu Service\n• Categories & Items\n• Modifiers & Variants\n• Redis Catalog Cache"]
        ORDER_SVC["🛒 Order Service\n• Order Lifecycle\n• Table Session Lock\n• Order Calculations"]
        PAYMENT_SVC["💳 Payment Service\n• Razorpay / Stripe\n• Invoice Generation\n• Transaction Logs"]
        NOTIF_SVC["⚡ Notification Service\n• WebSockets Server\n• KDS Sync\n• Redis Pub/Sub Sync"]
    end

    subgraph DataLayer ["Polyglot Persistence Layer"]
        PG_AUTH[(🐘 PostgreSQL - Auth DB)]
        PG_ORDER[(🐘 PostgreSQL - Order DB)]
        MONGO_CAT[(🍃 MongoDB - Menu DB)]
        REDIS_CACHE[(⚡ Redis Cache & Pub/Sub)]
    end

    Clients -->|REST / WSS| NGINX
    NGINX -->|/api/v1/auth| AUTH_SVC
    NGINX -->|/api/v1/menu| MENU_SVC
    NGINX -->|/api/v1/orders| ORDER_SVC
    NGINX -->|/api/v1/payments| PAYMENT_SVC
    NGINX -->|/ws| NOTIF_SVC

    AUTH_SVC --> PG_AUTH
    MENU_SVC --> MONGO_CAT
    MENU_SVC --> REDIS_CACHE
    ORDER_SVC --> PG_ORDER
    ORDER_SVC --> REDIS_CACHE
    PAYMENT_SVC --> PG_ORDER
    NOTIF_SVC --> REDIS_CACHE
```

### 3.1 Auth Service (`auth-service`) — Spring Boot
- **Responsibilities**:
  - Handles `/api/v1/auth/login`, `/api/v1/auth/register`, `/api/v1/auth/validate-token`.
  - Issues signed RS256 / HS256 JWT tokens containing `userId`, `role`, and `tableSessionId`.
  - Manages User credentials, Staff accounts, and RBAC permissions in **PostgreSQL**.
  - Serves as the security filter for intra-service authentication token verification.

### 3.2 Menu & Catalog Service (`menu-service`) — Node.js / Express
- **Responsibilities**:
  - CRUD operations for Categories, Menu Items, Size Variants, and Modifiers (Extra cheese, spice levels).
  - Uses **MongoDB** for document flexibility (varying item attributes, seasonal tags, allergen lists).
  - Implements **Redis** caching for read-heavy menu queries (`GET /api/v1/menu`). Invalidation happens automatically on admin menu edits.

### 3.3 Order Management Service (`order-service`) — Node.js / Express
- **Responsibilities**:
  - Handles order creation, status transitions, table session management, and bill calculations.
  - Stores transactional data in **PostgreSQL** (`Orders`, `OrderItems`, `TableSessions`).
  - Emits real-time state changes to Redis Pub/Sub channel (`order_events`) when an order moves from `SUBMITTED` ➔ `ACCEPTED` ➔ `PREPARING` ➔ `READY` ➔ `SERVED`.

### 3.4 Real-Time Notification & KDS Service (`notification-service`) — Node.js / Express + WebSockets
- **Responsibilities**:
  - Maintains persistent WebSocket connections with Kitchen KDS displays, Customer tracking pages, and Waiter devices.
  - Listens to Redis Pub/Sub (`order_events`, `waiter_alerts`) and broadcasts target updates to specific rooms (`room:kitchen`, `room:table_{id}`).

### 3.5 Payment & Invoicing Service (`payment-service`) — Node.js / Express
- **Responsibilities**:
  - Integrates with Razorpay / Stripe payment gateway SDKs.
  - Verifies payment webhooks and updates PostgreSQL `Payment` & `Order` records.
  - Generates itemized GST compliant PDF invoices.

---

## 4. 🗄️ Database Strategy & Data Modeling

### 4.1 Relational Data (PostgreSQL) — Transactional & Security Data

```sql
-- PostgreSQL Schema Overview

-- Users & Roles
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL, -- 'ADMIN', 'CHEF', 'WAITER', 'CASHIER'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Restaurant Tables
CREATE TABLE restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number INT UNIQUE NOT NULL,
    capacity INT NOT NULL,
    qr_token VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'VACANT' -- 'VACANT', 'OCCUPIED', 'RESERVED'
);

-- Orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(20) UNIQUE NOT NULL,
    table_id UUID REFERENCES restaurant_tables(id),
    status VARCHAR(30) NOT NULL, -- 'SUBMITTED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'
    payment_status VARCHAR(20) DEFAULT 'PENDING',
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order Items
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    mongo_item_id VARCHAR(50) NOT NULL, -- Reference to MongoDB Menu Document
    item_name VARCHAR(150) NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    modifiers_json JSONB, -- Selected add-ons and options snapshot
    special_notes TEXT
);

-- Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id),
    transaction_id VARCHAR(100) UNIQUE,
    payment_method VARCHAR(30) NOT NULL, -- 'UPI', 'CARD', 'CASH'
    status VARCHAR(20) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2 Document Data (MongoDB) — Catalog & Content Data

```json
// MongoDB "menu_items" Collection Document Sample
{
  "_id": ObjectId("669bd1a2e8f1a23456789abc"),
  "name": "Truffle Mushroom Pizza",
  "categoryId": ObjectId("669bd010e8f1a23456789000"),
  "categoryName": "Pizzas",
  "description": "Artisanal thin crust with wild mushrooms, truffle oil, and fresh mozzarella.",
  "basePrice": 14.99,
  "isAvailable": true,
  "dietaryFlags": ["VEGETARIAN"],
  "variants": [
    { "name": "Medium (10 inch)", "priceAdjustment": 0 },
    { "name": "Large (14 inch)", "priceAdjustment": 5.00 }
  ],
  "modifierGroups": [
    {
      "name": "Crust Choice",
      "minSelect": 1,
      "maxSelect": 1,
      "options": [
        { "name": "Classic Hand-Tossed", "price": 0 },
        { "name": "Cheese Burst", "price": 2.50 }
      ]
    },
    {
      "name": "Extra Toppings",
      "minSelect": 0,
      "maxSelect": 3,
      "options": [
        { "name": "Extra Cheese", "price": 1.50 },
        { "name": "Jalapenos", "price": 0.75 }
      ]
    }
  ],
  "imageUrl": "https://cdn.dineflow.com/menu/pizza-truffle.jpg",
  "preparationTimeMinutes": 18,
  "updatedAt": "2026-07-20T14:00:00Z"
}
```

---

## 5. ⚡ Real-Time Data Flow & Inter-Service Event Architecture

```mermaid
sequenceDiagram
    autonumber
    actor Customer as 📱 Customer Web App
    participant Nginx as 🌐 Nginx Gateway
    participant OrderSvc as 🛒 Order Service (Node)
    participant DB as 🐘 PostgreSQL DB
    participant Redis as ⚡ Redis Pub/Sub
    participant NotifSvc as ⚡ Notification Svc (Node)
    actor Kitchen as 🍳 Kitchen KDS

    Customer->>Nginx: POST /api/v1/orders (Cart data + Table Token)
    Nginx->>OrderSvc: Forward Order Request
    OrderSvc->>OrderSvc: Validate items, calculate taxes & total
    OrderSvc->>DB: INSERT into orders & order_items
    DB-->>OrderSvc: Order Created (ID: #105, Status: SUBMITTED)
    OrderSvc->>Redis: PUBLISH channel 'order_events' (Order #105 Data)
    OrderSvc-->>Nginx: 201 Created (Order Summary + ID)
    Nginx-->>Customer: Render Order Confirmation & Live Tracking UI

    Redis-->>NotifSvc: Consume Event 'order_events'
    NotifSvc->>Kitchen: Broadcast WebSocket Event 'NEW_ORDER' to room 'kitchen'
    Note over Kitchen: Kitchen KDS plays alert sound & renders Order #105 Card
```

---

## 6. 🌐 Nginx API Gateway & Reverse Proxy Configuration

Below is the Nginx configuration routing incoming client requests to the corresponding backend microservices:

```nginx
# nginx.conf - API Gateway & Load Balancer

upstream auth_service {
    server auth-service:8081;
}

upstream menu_service {
    server menu-service:3001;
}

upstream order_service {
    server order-service:3002;
}

upstream payment_service {
    server payment-service:3003;
}

upstream notification_service {
    server notification-service:3004;
}

server {
    listen 80;
    server_name localhost;

    # Gzip compression
    gzip on;
    gzip_types text/plain application/json application/javascript text/css;

    # Auth Service Route (Spring Boot)
    location /api/v1/auth/ {
        proxy_pass http://auth_service/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Menu Service Route (Node/Express)
    location /api/v1/menu/ {
        proxy_pass http://menu_service/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Order Service Route (Node/Express)
    location /api/v1/orders/ {
        proxy_pass http://order_service/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Payment Service Route (Node/Express)
    location /api/v1/payments/ {
        proxy_pass http://payment_service/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket Real-time Route (Socket.io / WS)
    location /ws/ {
        proxy_pass http://notification_service/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }

    # React Frontend Static Build (Production)
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 7. 🐳 Docker & Docker Compose Containerization Architecture

The entire microservice system is orchestrated using Docker Compose.

```yaml
# docker-compose.yml
version: '3.8'

networks:
  scdp-network:
    driver: bridge

volumes:
  postgres_data:
  mongo_data:
  redis_data:

services:
  # ----------------------------------------------------
  # Databases & Caches
  # ----------------------------------------------------
  postgres-db:
    image: postgres:16-alpine
    container_name: scdp-postgres
    environment:
      POSTGRES_DB: scdp_db
      POSTGRES_USER: scdp_user
      POSTGRES_PASSWORD: scdp_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - scdp-network

  mongo-db:
    image: mongo:7.0
    container_name: scdp-mongo
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    networks:
      - scdp-network

  redis-cache:
    image: redis:7.2-alpine
    container_name: scdp-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - scdp-network

  # ----------------------------------------------------
  # Microservices
  # ----------------------------------------------------
  auth-service:
    build:
      context: ./backend/auth-service
      dockerfile: Dockerfile
    container_name: scdp-auth-svc
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres-db:5432/scdp_db
      SPRING_DATASOURCE_USERNAME: scdp_user
      SPRING_DATASOURCE_PASSWORD: scdp_password
      JWT_SECRET: your_super_secret_jwt_key_32_chars_min
    depends_on:
      - postgres-db
    networks:
      - scdp-network

  menu-service:
    build:
      context: ./backend/menu-service
      dockerfile: Dockerfile
    container_name: scdp-menu-svc
    environment:
      PORT: 3001
      MONGO_URI: mongodb://mongo-db:27017/scdp_menu
      REDIS_HOST: redis-cache
      REDIS_PORT: 6379
    depends_on:
      - mongo-db
      - redis-cache
    networks:
      - scdp-network

  order-service:
    build:
      context: ./backend/order-service
      dockerfile: Dockerfile
    container_name: scdp-order-svc
    environment:
      PORT: 3002
      POSTGRES_URI: postgresql://scdp_user:scdp_password@postgres-db:5432/scdp_db
      REDIS_HOST: redis-cache
      REDIS_PORT: 6379
    depends_on:
      - postgres-db
      - redis-cache
    networks:
      - scdp-network

  notification-service:
    build:
      context: ./backend/notification-service
      dockerfile: Dockerfile
    container_name: scdp-notif-svc
    environment:
      PORT: 3004
      REDIS_HOST: redis-cache
      REDIS_PORT: 6379
    depends_on:
      - redis-cache
    networks:
      - scdp-network

  # ----------------------------------------------------
  # Frontend & API Gateway
  # ----------------------------------------------------
  frontend-react:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: scdp-frontend
    networks:
      - scdp-network

  nginx-gateway:
    image: nginx:alpine
    container_name: scdp-gateway
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - auth-service
      - menu-service
      - order-service
      - notification-service
      - frontend-react
    networks:
      - scdp-network
```

---

## 8. 📁 Target Directory & Repository Structure

```
SCDP-Project/
├── .agents/
│   └── AGENTS.md                   # Workspace agent guidelines
├── context/
│   ├── project.spec.md             # Master System Specification (SRS)
│   └── project.architect.md        # Architecture & Microservices Specification
├── docker-compose.yml              # Multi-container orchestration
├── nginx/
│   └── nginx.conf                  # Nginx API Gateway & Reverse Proxy config
├── backend/
│   ├── auth-service/               # Spring Boot 3.x (Spring Security, JWT, PostgreSQL)
│   │   ├── src/main/java/com/dineflow/auth/
│   │   ├── pom.xml / build.gradle
│   │   └── Dockerfile
│   ├── menu-service/               # Node.js + Express + MongoDB + Redis
│   │   ├── src/
│   │   ├── package.json
│   │   └── Dockerfile
│   ├── order-service/              # Node.js + Express + PostgreSQL + Redis
│   │   ├── src/
│   │   ├── package.json
│   │   └── Dockerfile
│   ├── payment-service/            # Node.js + Express + Razorpay/Stripe
│   │   ├── src/
│   │   ├── package.json
│   │   └── Dockerfile
│   └── notification-service/       # Node.js + Express + WebSockets + Redis Pub/Sub
│       ├── src/
│       ├── package.json
│       └── Dockerfile
└── frontend/                       # React 18 SPA / PWA (Vite, Tailwind, Redux)
    ├── src/
    │   ├── components/             # Reusable UI components
    │   ├── pages/
    │   │   ├── customer/           # Customer ordering & tracking views
    │   │   ├── kitchen/            # Kitchen Display System (KDS)
    │   │   └── admin/              # Admin dashboard & analytics
    │   ├── store/                  # Redux / React Query state
    │   └── services/               # Axios API clients & WebSocket listeners
    ├── package.json
    └── Dockerfile
```

---

## 9. 🎯 Summary & Next Steps

This architecture provides:
- **Scalability**: Each microservice can be scaled independently based on load (e.g., scaling `notification-service` during peak dining hours).
- **Security**: Spring Boot enforces centralized JWT authentication and authorization.
- **Speed**: Node.js handles async I/O efficiently, with MongoDB providing rapid reads for menu items and Redis keeping latency under 50ms.
- **Portability**: The entire stack is containerized with Docker Compose for seamless local development and production deployment.
