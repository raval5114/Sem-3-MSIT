# DineFlow QR Table Management — Phase Timeline

This timeline tracks delivery of the QR table management, ordering, order tracking, revenue analytics, and release-readiness feature described in [QR_Table_Management_and_Revenue_Analytics.md](QR_Table_Management_and_Revenue_Analytics.md).

Dates are intentionally left as **TBD** because no delivery calendar or phase durations have been agreed. Check a phase only after its implementation and required verification are complete.

## Timeline chart

| Order | Phase | Scope | Depends on | Target window | Status |
|---:|---|---|---|---|---|
| 1 | Table domain and staff authorization | Restaurant-scoped table schema, staff CRUD/status APIs, validation, authorization, audit metadata | — | TBD | ✅ Complete |
| 2 | QR issuance and customer session | QR credential issue/rotation, QR display/download, scan initialization, customer JWT, Redis session state, staff close | Phase 1 | TBD | ✅ Complete |
| 3 | Customer menu and checkout | Menu browsing, cart/modifiers, validated checkout, order snapshots, payment choices | Phase 2 | TBD | ✅ Complete |
| 4 | Kitchen updates and customer tracking | KDS queue, order transitions, Redis events, scoped WebSockets, customer status view and reconnect catch-up | Phase 3 | TBD | ✅ Complete |
| 5 | Table revenue analytics | Staff privilege, tenant-scoped revenue aggregation, reporting semantics, admin panel | Phases 3–4 (settled order/payment records) | TBD | ⬜ Not started |
| 6 | Containerization and release readiness | Docker/Compose wiring, health checks, migrations/seeds, complete test suites and operational documentation | Phases 1–5 | TBD | ⬜ Not started |

## Phase completion checklist

### Phase 1 — Table domain and staff authorization

- [x] Table domain and restaurant-scoped persistence implemented.
- [x] Staff table create/read/update/status operations and authorization implemented.
- [x] Validation and automated tests completed.

### Phase 2 — QR issuance and customer session

- [x] Opaque QR credentials, hash persistence, rotation, and QR rendering implemented.
- [x] Customer scan route initializes or reuses a table session and receives a scoped customer token.
- [x] Redis session state and staff session closure implemented.
- [x] Verification completed: Auth Service tests pass; React production build and scoped ESLint checks pass.

### Phase 3 — Customer menu and checkout

- [x] Customer menu data integration with the Menu Service, filtered to active categories and available products.
- [x] Cart UI with variant/modifier selection and server-side availability, modifier, and price validation.
- [x] PostgreSQL order schema and transactional order/item snapshot persistence implemented.
- [x] Pay-at-counter checkout path and order confirmation implemented.
- [x] Automated menu/checkout/JWT/session and HTTP route tests added.
- [x] Verify order schema and transaction-compatible inserts against the running PostgreSQL stack; verify Order Service health and Menu Service connectivity.
- [x] Select and configure an online payment provider; implement intent/verification flow and tests.

### Phase 4 — Kitchen updates and customer tracking

- [x] Kitchen queue and permitted order-status transitions.
- [x] Redis event publishing and authenticated, scoped customer/kitchen updates.
- [x] Customer order status screen, reconnect behavior, and REST catch-up.
- [x] Integration and end-to-end tests.

### Phase 5 — Table revenue analytics

- [ ] `TABLE_REVENUE_READ` privilege and role assignments.
- [ ] Tenant-scoped revenue aggregation from settled/captured payments and refunds.
- [ ] Staff-only table revenue panel with reporting period and currency.
- [ ] Authorization, revenue calculation, and endpoint tests.

### Phase 6 — Containerization and release readiness

- [ ] Dockerfiles and Compose dependencies, health checks, and environment settings verified.
- [ ] Local migration/seed flow documented and exercised.
- [ ] Unit, integration, end-to-end, security, and resilience suites pass.
- [ ] Staff operating guidance for QR lifecycle, table  sessions, payments, and revenue published.

## Progress

**Completed:** 4 of 6 phases (67%).  
**In progress:** Phase 5 — Table revenue analytics.  
**Next:** Implement `TABLE_REVENUE_READ` privilege, tenant-scoped revenue aggregation endpoint, and staff analytics dashboard.

> Update this file when a phase is finalized. Mark its status complete only after the phase's implementation checklist and applicable tests are done.
    