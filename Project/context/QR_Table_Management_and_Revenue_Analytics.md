# DineFlow — QR Table Management, Ordering, and Table Revenue Analytics

## Feature Name

**QR-Based Restaurant Table Management with Order Tracking and Table Revenue Analytics**

## 1. Purpose

Allow restaurant staff to configure and manage tables, generate reusable QR codes, and review authorized revenue analytics for each table. Customers scan a table QR code to open the React customer app, join an active table session, browse the restaurant's live menu, place an order, select a payment method, and track order progress.

The platform stack for this feature is **React, Node.js, Spring Boot, PostgreSQL, MongoDB, Redis, and Docker**.

## 2. Feature Breakdown

### 2.1 Staff Table Setup

The staff-facing React admin experience allows authorized staff to create, edit, activate, deactivate, and inspect tables.

Suggested table fields:

| Field | Purpose |
|---|---|
| `tableId` | Internal unique identifier. |
| `restaurantId` | Tenant ownership, derived from the authenticated staff identity on writes. |
| `tableNumber` | Restaurant-visible table number; unique within a restaurant. |
| `seatingCapacity` | Number of guests the table can seat. |
| `section` | Optional area such as patio, main hall, or private dining. |
| `displayName` | Optional friendly name shown in staff tools. |
| `status` | `ACTIVE`, `INACTIVE`, or `MAINTENANCE`. |
| `qrCredentialVersion` | Version used to revoke previously generated QR credentials. |
| `createdAt`, `updatedAt` | Audit timestamps. |

Only users with an appropriate privilege, such as `TABLE_MANAGE`, can change table setup or issue/revoke QR codes. All operations are scoped to the restaurant in the verified staff JWT.

### 2.2 QR Code Generation

After a table is created, the backend generates an opaque, high-entropy QR credential and returns a customer URL for encoding as a QR code. The QR can be rendered in the React admin app for download/print.

Example URL:

```text
https://dineflow.example/r/{restaurantSlug}/t/{tablePublicId}?token={opaqueQrToken}
```

The QR identifies the restaurant and table and proves that the code was issued by DineFlow. It **does not contain a live `sessionId` or customer authorization token**. A printed QR is reusable across visits; the server creates or joins the active session after scan. Store only a hash of the QR credential where practical. Regenerating a QR increments its version or replaces its credential so the previous printed code can be revoked.

### 2.3 Customer Scan and Table Session

The React customer app reads the QR URL and calls the Spring Boot Auth Service to initialize a session. The service validates the credential, table state, and restaurant ownership, then:

1. Reuses the current active session for that table, or creates one if none exists.
2. Issues a short-lived customer JWT containing `restaurantId`, `tableId`, `tableSessionId`, `type`, and customer permissions.
3. Publishes/updates the active session state in Redis so downstream services can quickly reject closed sessions.

Each guest can receive an individual customer identity while joining the same table session. Session close invalidates further ordering for that session. The UI should show a clear error if the QR is revoked, table inactive, or session closed.

### 2.4 Menu, Cart, Order, and Payment

The customer app requests the menu from the Node.js Menu Service. Menu items, variants, modifiers, ingredients, and availability are read from MongoDB, with Redis used for appropriate caching.

On checkout, the Node.js Order Service validates the customer JWT and active session, rechecks the current item availability and modifier rules with the Menu Service, calculates prices and totals on the server, and stores an order plus immutable item/price snapshots in PostgreSQL.

The customer selects a supported payment method, for example online payment or pay at counter:

- **Online payment:** Payment Service creates the provider payment intent. The order is released to the kitchen only after server-side payment verification succeeds.
- **Pay at counter:** Order may be sent to the kitchen after placement and remains payment-pending until cashier settlement.

Failed or pending online payments must not be treated as paid. Provider webhooks/signatures are verified server-side.

### 2.5 Order Status Dashboard

Kitchen staff update the order through the React Kitchen Display System. The Order Service validates allowed state transitions, persists the status in PostgreSQL, and publishes an event through Redis. The Notification Service broadcasts updates over authenticated WebSockets to the relevant customer session/order and kitchen room.

Suggested states:

```text
SUBMITTED → PAYMENT_PENDING (when applicable) → ACCEPTED → PREPARING → READY → SERVED → COMPLETED
                                                        ↘ CANCELLED (where permitted)
```

The customer app should load the current status over REST and subscribe to WebSocket updates. It should refresh status after reconnecting to recover missed events.

### 2.6 Table Revenue Analytics

The staff table-management screen includes a **Table Revenue** option. Authorized staff select a table and reporting period to view completed order count, gross revenue, refunds, and net revenue. This analytics option is available to staff only, protected by a separate privilege such as `TABLE_REVENUE_READ` and restaurant-level authorization.

Auth Service verifies the staff identity and privilege. Revenue is computed by the Order/Analytics service from PostgreSQL order and payment records; it is not stored as a manually maintained total on the table record. This keeps analytics tied to the payment source of truth.

Revenue rules:

- Include orders whose payment status is `PAID` or `REFUNDED`; online captures update the order only after payment verification, and counter orders count once staff records them as paid.
- Exclude unpaid, pending, failed, and cancelled orders.
- Subtract recorded refund amounts from gross revenue, capped at each order's total, to calculate net revenue.
- Avoid counting duplicate payment webhook deliveries more than once.
- Attribute orders by `restaurantId`, `tableId`, and `tableSessionId`.
- Treat `from` and `to` as inclusive UTC calendar dates and filter by order creation date.
- Return currency and the requested reporting period with totals. Phase 5 checkout currently records INR.
- Grant `TABLE_REVENUE_READ` to `RESTAURANT_ADMIN` and `SUPER_ADMIN`; the service still requires a staff token and restaurant scope.

Example endpoint:

```http
GET /api/v1/analytics/tables/{tableId}/revenue?from=2026-10-01&to=2026-10-31
Authorization: Bearer <staff-jwt>
```

Example response:

```json
{
  "tableId": "table_8",
  "period": { "from": "2026-10-01", "to": "2026-10-31" },
  "completedOrders": 42,
  "grossRevenue": 18650.00,
  "refunds": 350.00,
  "netRevenue": 18300.00,
  "currency": "INR"
}
```

For an MVP, aggregate from source order/payment records. Add daily per-table aggregates only if reporting volume makes live aggregation too slow; aggregates must be rebuildable from source records.

## 3. Service Responsibilities

| Component | Responsibility |
|---|---|
| React Admin | Table setup, QR display/download, staff-only table revenue view. |
| React Customer App | QR landing, session UX, menu/cart/checkout, order status dashboard. |
| React KDS | Kitchen queue and authorized order status changes. |
| Spring Boot Auth Service | Staff authentication/privileges, table management authorization, QR credential issuance/revocation, session initialization/closure, customer JWT issuance. |
| Node.js Menu Service + MongoDB | Menu catalogue, item details, variants, modifiers, and availability. |
| Node.js Order Service + PostgreSQL | Order validation/persistence, item snapshots, lifecycle, table revenue aggregation or analytics endpoint. |
| Node.js Payment Service + PostgreSQL | Payment intent, callback/webhook verification, settlement and refund records. |
| Node.js Notification Service + Redis | Redis event consumption and authenticated WebSocket updates. |
| Redis | Active-session state/cache and event Pub/Sub. |
| Docker | Local and deployment packaging for the services. |

Auth Service owns identity and authorization for the table session. Order and payment data remain owned by their respective services. Downstream services verify JWTs locally using the Auth Service JWKS and check the active session state before accepting customer actions.

## 4. Core Data Relationships

```text
Restaurant 1 ── many Tables
Table      1 ── many TableSessions (over time)
TableSession 1 ── many Orders
Order      1 ── many OrderItems (with menu/price snapshots)
Order      1 ── one or more PaymentAttempts / PaymentRecords
```

`restaurantId` must be present or enforceable for every table, session, order, and payment query. PostgreSQL order/payment data should retain `restaurantId`, `tableId`, and `tableSessionId` to support tenant-safe reporting without depending on a live cross-database join to MongoDB.

## 5. Suggested API Surface

### Staff table and QR management

```text
POST   /api/v1/admin/tables
GET    /api/v1/admin/tables
GET    /api/v1/admin/tables/:tableId
PATCH  /api/v1/admin/tables/:tableId
PATCH  /api/v1/admin/tables/:tableId/status
POST   /api/v1/admin/tables/:tableId/qr/rotate
```

### Customer session and ordering

```text
POST   /api/v1/auth/table-session/init
POST   /api/v1/auth/table-session/:sessionId/close
GET    /api/v1/menu/categories
GET    /api/v1/menu/items/:itemId
POST   /api/v1/orders
GET    /api/v1/orders/:orderId
GET    /api/v1/orders/:orderId/status
POST   /api/v1/payments/create-intent
POST   /api/v1/payments/webhook
```

Session close should be staff-authorized and coordinated with the order/payment workflow so an unsettled table is not closed accidentally.

### Staff table revenue

```text
GET /api/v1/analytics/tables/:tableId/revenue?from={date}&to={date}
```

All admin endpoints must derive tenant scope from the verified staff JWT rather than trusting a client-provided `restaurantId`.

## 6. Testing Phase

### Unit tests

- Table number uniqueness within a restaurant and field validation.
- QR credential generation, hashing, rotation, revocation, and invalid-token rejection.
- Session create/reuse/close behavior and closed-session rejection.
- JWT claims and privilege checks for staff and customer identities.
- Order total calculation, modifier constraints, and immutable item-price snapshots.
- Payment state transitions, duplicate webhook idempotency, refunds, and revenue math.
- Revenue includes only captured/settled payments and subtracts refunds.
- Tenant scoping prevents cross-restaurant table/revenue access.

### Integration tests

- Admin API → Auth Service → PostgreSQL table record and QR credential.
- QR session initialization → active session in Redis → customer JWT.
- Customer JWT → Menu Service reads available menu data from MongoDB.
- Checkout → Order Service persists order and item snapshots in PostgreSQL.
- Online payment verification and pay-at-counter flows.
- Order status update → PostgreSQL → Redis event → Notification Service event.
- Staff revenue endpoint → authorized aggregation across orders and payments.
- Session close blocks new orders and WebSocket subscriptions as designed.

### End-to-end tests

1. Staff creates a table and downloads its QR code.
2. Customer scans the QR and starts or joins the active session.
3. Customer browses the menu, adds an item/modifier, and submits an order.
4. Payment is completed online or marked for counter settlement.
5. Kitchen updates status and the customer dashboard receives updates.
6. Staff settles/closes the table session.
7. Authorized staff views the table's revenue for a date range; unauthorized roles and other restaurants are denied.

### Security and resilience tests

- Expired, malformed, revoked QR token and JWT behavior.
- Replayed/duplicate payment webhooks.
- Unauthorized and cross-tenant requests.
- Closed/inactive table/session ordering attempts.
- WebSocket reconnect and status catch-up.
- Redis unavailable behavior: fail closed for session authorization where active-session state cannot be safely verified; surface a retryable service error.

## 7. Implementation Steps

### Phase 1 — Table domain and staff authorization

1. Finalize table/session ownership and role/privilege mapping.
2. Add table schema and restaurant-scoped unique table number constraint in PostgreSQL.
3. Implement staff CRUD/status APIs and validation in Spring Boot.
4. Add audit metadata for table changes.

### Phase 2 — QR issuance and customer session

1. Implement opaque QR credential generation, persistence as a hash, rotation, and revocation.
2. Generate the customer URL and render/download the QR in React Admin.
3. Implement QR session initialization and active-session reuse/create behavior.
4. Issue customer JWTs scoped to restaurant, table, and session.
5. Publish active session state to Redis and implement session-close invalidation.

### Phase 3 — Customer menu and checkout

1. Add QR landing and error states to the React Customer App.
2. Load categories/items from Node.js Menu Service and MongoDB.
3. Build cart, variant/modifier selection, and server-validated checkout.
4. Persist order and item/price snapshots in PostgreSQL.
5. Implement online payment and pay-at-counter paths with explicit state transitions.

### Phase 4 — Kitchen updates and customer tracking

1. Implement KDS order queue and allowed status transitions.
2. Publish order/payment changes through Redis.
3. Authenticate and scope Notification Service WebSocket rooms.
4. Add customer order status dashboard, reconnect, and REST catch-up.

### Phase 5 — Table revenue analytics

1. Add `TABLE_REVENUE_READ` privilege and assign it to approved staff roles.
2. Implement tenant-scoped table revenue aggregation in Order/Analytics Service.
3. Define date range, timezone, currency, settlement, and refund semantics.
4. Add the staff-only table revenue panel in React Admin.
5. Add audit logging for revenue access if required by restaurant policy.

### Phase 6 — Containerization and release readiness

1. Add/update Dockerfiles and Docker Compose service wiring, health checks, and environment variables.
2. Verify service dependencies and migrations/seeding for a local restaurant/table.
3. Run unit, integration, end-to-end, security, and resilience test suites.
4. Document QR printing, QR rotation, session closure, payment handling, and revenue definitions for staff.

## 8. Key Decisions to Confirm During Implementation

- Whether all guests at a table can see every order in the shared table session, or only orders they placed.
- Whether table revenue means gross sales, net collected revenue, or both; this document proposes reporting gross, refunds, and net collected revenue separately.
- Which staff roles receive `TABLE_REVENUE_READ`.
- Whether sessions close automatically after settlement or require a staff action.
- Which online payment provider and currency/tax rules are enabled for the restaurant.

