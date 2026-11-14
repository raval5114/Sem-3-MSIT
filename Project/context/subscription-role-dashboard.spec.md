# DineFlow — Subscription-Aware Role Dashboards & Restaurant Feature Access

> Version: 1.0 | Status: Proposed enhancement for project-guide review | Date: 02 November 2026

## 1. Purpose

This document specifies an additive DineFlow enhancement combining:
1. Super Admin management of restaurant onboarding, plans, subscriptions and feature entitlements.
2. Existing RBAC privileges with subscription-aware feature authorization.
3. Separate role-specific dashboard shells, navigation and title bars.
4. Context-aware branding: **DineFlow** for Super Admin and the authorized **restaurant name** for restaurant-oriented roles.

The enhancement must preserve the current customer QR/table-session, menu, cart, ordering, payment, kitchen and notification workflows.

## 2. Relationship to supplied project files

| Source document | Existing architecture retained | Relationship to this feature |
|---|---|---|
| `project.spec.md` | SCDP/DineFlow, Customer PWA, KDS, Admin Portal, waiter experience, QR sessions, menu/order/payment workflows, React, Node.js, Spring Boot, PostgreSQL, MongoDB, Redis, Docker | Adds subscription-aware access and role-specific dashboards around existing modules |
| `project.auth.md` | Central Spring Boot Auth Service, RS256 JWT, JWKS, local downstream verification, RBAC, `restaurantId` tenant isolation, staff and customer identities | Extends authorization decisions without replacing authentication or existing roles/privileges |
| `project.endpoint.md` | REST API plus MCP interface; shared backend business logic | Adds proposed REST endpoint families; MCP tools must reuse the same authorization and service-layer rules |
| `NEW_FEATURES.md` | AI Restaurant Agent, Food Knowledge Graph, Skill-Aware Kitchen, Personal Dining Agent, Simulation Engine, Context-Aware Adaptive Menu | These can become feature-catalogue entries; this document does not claim they are already implemented |

### Existing decisions to preserve

- React remains the frontend.
- Spring Boot Auth Service remains responsible for credentials, password hashing, refresh tokens and RS256 token issuance.
- Downstream Node.js services continue local JWT verification through JWKS.
- Node.js services continue to own the menu, order, payment and notification capabilities described in the auth architecture.
- PostgreSQL remains the source of truth for relational/security/subscription data; MongoDB remains the menu/catalogue store.
- Redis remains cache and Pub/Sub infrastructure; Nginx remains the gateway.
- Every restaurant-scoped database query must be constrained by the authorized `restaurantId` from verified identity/context.
- Customer QR table-session JWTs and the existing customer flow remain a separate identity path.

The supplied `project.endpoint.md` gives generic Node and Spring examples for REST/MCP. Implementation must follow actual DineFlow service ownership and gateway routing rather than creating duplicate business logic.

## 3. Goals

- Approve/reject restaurant registrations and generate unique server-side Restaurant IDs.
- Create subscription plans: Starter, Professional, Enterprise and Custom.
- Configure feature entitlements and optional usage limits per plan.
- Assign, renew, cancel, expire and suspend restaurant subscriptions.
- Support audited restaurant-specific feature overrides.
- Combine subscription entitlements with existing role privileges.
- Give each supported staff/platform role its own dashboard shell and landing page.
- Generate navigation, page title bars and actions from effective access.
- Display DineFlow for Super Admin and the authorized restaurant name for restaurant users.
- Enforce authorization on backend routes/services, not only in React.
- Invalidate stale access after subscription, entitlement, role or membership changes.

## 4. Out of scope

Unless separately approved: automated recurring billing/payment gateway, final commercial prices, replacement of Auth Service/JWT, rewrite of QR ordering, implementation of the intelligent features themselves, and unrestricted AI/LLM database access.

## 5. Roles and dashboard experience

The existing RBAC documents define `SUPER_ADMIN`, `RESTAURANT_ADMIN`, `CASHIER`, `CHEF`/`KITCHEN_STAFF`, `WAITER` and `CUSTOMER_GUEST`.

| Role | Dashboard experience | Header identity | Typical focus (only if entitled and permitted) |
|---|---|---|---|
| `SUPER_ADMIN` | Platform dashboard | **DineFlow** | Restaurant approvals, directory, plans, subscriptions, feature catalogue, audit |
| `RESTAURANT_ADMIN` | Restaurant admin dashboard | Authorized restaurant name | Overview, menu, orders, tables/QR, inventory, staff, reports |
| `WAITER` | Waiter dashboard | Authorized restaurant name | Assigned tables, assistance requests, serving/order actions |
| `CHEF` / `KITCHEN_STAFF` | Kitchen/KDS dashboard | Authorized restaurant name | Incoming orders, preparation stages, ready queue |
| `CASHIER` | Cashier dashboard | Authorized restaurant name | Bills, payments, receipts and permitted session closing |
| Other restaurant staff roles | Role-specific dashboard | Authorized restaurant name | Only assigned modules/actions |
| `CUSTOMER_GUEST` | Existing QR/table-session customer app | Existing restaurant/customer context | Menu, cart, order, tracking, assistance and payment |

A separate dashboard means a distinct role-appropriate shell, navigation and landing experience; it does not require separate React applications or duplicated UI primitives. The customer guest remains in the QR/table-session app rather than being forced into a staff dashboard.

## 6. Dashboard UI requirements

### 6.1 Role-specific shells
Provide distinct shells/routes for Super Admin, Restaurant Admin, Waiter, Kitchen and Cashier. Shared header/sidebar/title-bar components may be reused, but each role must have its own permitted navigation and landing page.

### 6.2 Dynamic navbar
Navigation is generated from backend-provided effective access. An item appears only when the relevant feature is enabled and the user has the required privilege. Role name alone must not be treated as the permission source.

### 6.3 Dynamic title bar
The title bar reflects the active role dashboard and current page/module. Contextual actions appear only when authorized.

### 6.4 Branding
- Super Admin: `DineFlow`.
- Restaurant Admin, Waiter, Chef/Kitchen Staff, Cashier and other restaurant-scoped staff: authorized restaurant name.
- Customer Guest: preserve existing customer/table-session presentation.

Restaurant name and `restaurantId` must be resolved from authenticated server-side identity/membership. Never trust a client-supplied name, local-storage value or URL parameter as proof of tenant identity.

### 6.5 Multiple restaurant memberships
The supplied files do not define whether a staff account may belong to multiple restaurants. First release should preserve the existing single `restaurantId` context unless multi-membership is explicitly approved. If switching is required, use a server-validated active-restaurant selection flow.

## 7. Feature catalogue and subscriptions

### 7.1 Candidate feature keys
Existing and future modules may be represented by stable feature keys, for example:

`MENU_MANAGEMENT`, `ORDER_MANAGEMENT`, `TABLE_QR_MANAGEMENT`, `KITCHEN_DISPLAY`, `WAITER_OPERATIONS`, `CASHIER_OPERATIONS`, `INVENTORY`, `ANALYTICS`, `AI_RESTAURANT_AGENT`, `FOOD_KNOWLEDGE_GRAPH`, `SKILL_AWARE_KITCHEN`, `PERSONAL_DINING_AGENT`, `SIMULATION_ENGINE`, `CONTEXT_AWARE_ADAPTIVE_MENU`.

These are proposed catalogue identifiers, not a statement that every module exists today. Each catalogue record should include key, display name, description, category, status and optional limits.

### 7.2 Plans
Initial plan names: Starter, Professional, Enterprise and Custom. Actual prices, included features and limits remain configurable business decisions.

### 7.3 Subscription states
Proposed states: `TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELLED`, `EXPIRED`, `SUSPENDED`. Define grace periods, paid-through behaviour and transition rules before implementation.

### 7.4 Overrides
Authorized Super Admins may add or restrict a feature for a restaurant outside the plan baseline. Each override records feature, state, reason, actor, effective period and audit metadata. Overrides cannot bypass platform/restaurant suspension.

## 8. Effective access policy

For restaurant users, access requires all applicable conditions:

```text
active user and membership
AND approved/active restaurant
AND subscription policy permits access
AND feature entitlement is enabled
AND role has the required action privilege
```

For Super Admin, use platform-level privileges and a platform scope; do not require a restaurant subscription.

Recommended precedence:
1. Inactive/suspended platform or restaurant context denies access.
2. Subscription lifecycle policy is evaluated.
3. Plan features establish baseline entitlements.
4. Valid authorized overrides adjust the baseline.
5. Role privilege is always required for the requested action.
6. A feature entitlement never grants a role permission by itself.

A feature key (e.g. `ANALYTICS`) is not the same as an action privilege (e.g. `ANALYTICS_READ`).

## 9. Authentication and access context

### 9.1 Preserve the existing security model
Keep centralized Spring Boot authentication, RS256 signing, JWKS and local downstream token verification. Existing staff JWTs include `sub`, `restaurantId`, `type`, `roles` and `privileges`; customer table-session tokens include `restaurantId`, `tableId`, `tableSessionId`, `type`, `roles` and customer privileges.

Do not embed a large, long-lived copy of all plan/feature state in JWTs and assume it remains current after a revocation.

### 9.2 Proposed access-context API
`GET /api/v1/access/context` should return a server-computed response similar to:

```json
{
  "identity": {"userId": "user-id", "type": "STAFF", "roles": ["RESTAURANT_ADMIN"]},
  "context": {
    "scope": "RESTAURANT",
    "restaurantId": "rest_example",
    "restaurantName": "The Grand Restaurant",
    "restaurantStatus": "ACTIVE"
  },
  "subscription": {"planKey": "PROFESSIONAL", "status": "ACTIVE"},
  "features": [
    {"key": "MENU_MANAGEMENT", "enabled": true,
     "permissions": ["MENU_READ", "MENU_CREATE", "MENU_UPDATE"]}
  ],
  "navigation": [
    {"key": "menu", "label": "Menu Management", "route": "/restaurant/menu",
     "requiredFeature": "MENU_MANAGEMENT", "requiredPrivilege": "MENU_READ"}
  ],
  "dashboard": {"key": "RESTAURANT_ADMIN", "homeRoute": "/restaurant-admin"},
  "accessVersion": 12
}
```

For Super Admin, use `scope: PLATFORM`, dashboard key `SUPER_ADMIN`, and branding `DineFlow`. This response informs UI rendering; it does not replace backend checks on each protected API.

### 9.3 Revocation freshness
The current staff access-token TTL is documented as 15 minutes. Token-embedded privileges alone may therefore remain stale after revocation. Recommended approach:
- Keep JWT signature/identity verification local.
- Check sensitive effective permissions against a short-lived access cache or authoritative authorization service.
- Maintain an authorization/access version for relevant restaurant/user scope.
- Increment it on subscription, entitlement, membership, role or privilege changes.
- Publish invalidation events via Redis Pub/Sub.
- On cache miss/version mismatch, recompute from PostgreSQL.
- Set bounded cache TTL and fail closed for sensitive operations when authorization state cannot be confirmed.

## 10. Data model additions

Extend the existing schema; do not duplicate `roles`, `privileges` or `role_privileges`.

| Entity | Responsibility |
|---|---|
| `restaurants` | Restaurant identity, name, approval and status |
| `restaurant_registrations` | Pending registration/review data if separate from restaurant record |
| `features` | Feature catalogue |
| `subscription_plans` | Plan definitions |
| `plan_features` | Plan-feature mapping and limits |
| `restaurant_subscriptions` | Subscription state and dates |
| `entitlement_overrides` | Restaurant-specific overrides |
| `restaurant_memberships` | User/restaurant association if multi-membership is supported |
| `authorization_versions` | Cache/version tracking |
| `subscription_events` | Lifecycle history |
| `audit_logs` | Administrative/security audit trail |

### Schema compatibility warning
The current auth document shows `users.restaurant_id NOT NULL` and `users.email UNIQUE`. A platform Super Admin may not belong to a restaurant, and multi-membership may require a user-to-restaurant mapping. Decide whether to permit platform users without restaurant membership or keep platform admins in a separate account model. Do not implement this by adding a parallel RBAC schema.

## 11. Proposed API surface

These are additions, not endpoints claimed to exist in the supplied endpoint document.

**Access context**
- `GET /api/v1/access/context`
- `GET /api/v1/access/features`
- `GET /api/v1/access/navigation`

**Super Admin / restaurants**
- `GET /api/v1/platform/restaurants`
- `POST /api/v1/platform/restaurants/{restaurantId}/approve`
- `POST /api/v1/platform/restaurants/{restaurantId}/reject`
- `POST /api/v1/platform/restaurants/{restaurantId}/suspend`
- `POST /api/v1/platform/restaurants/{restaurantId}/activate`

**Features, plans and subscriptions**
- `GET/POST /api/v1/platform/features`
- `GET/POST /api/v1/platform/plans`
- `PUT /api/v1/platform/plans/{planId}`
- `PUT /api/v1/platform/plans/{planId}/features`
- `POST /api/v1/platform/restaurants/{restaurantId}/subscriptions`
- `GET /api/v1/platform/restaurants/{restaurantId}/subscriptions`
- `PATCH /api/v1/platform/subscriptions/{subscriptionId}`
- `POST /api/v1/platform/restaurants/{restaurantId}/entitlement-overrides`
- `DELETE /api/v1/platform/entitlement-overrides/{overrideId}`

**Restaurant membership and role administration**
- `GET/POST /api/v1/restaurant/members`
- `PATCH /api/v1/restaurant/members/{userId}`
- `GET /api/v1/restaurant/roles`
- `GET /api/v1/restaurant/roles/{roleId}/permissions`
- `PUT /api/v1/restaurant/roles/{roleId}/permissions`

Restaurant-scoped endpoints must derive the authorized tenant from verified identity. Client-supplied IDs must never override the tenant boundary.

### MCP
Any MCP tool for these operations must invoke the same service-layer use case and the same tenant/subscription/feature/role checks as REST. No direct database access from an LLM; destructive or financial operations require confirmation and audit logging.

## 12. Redis and audit

PostgreSQL remains source of truth. Redis is for computed-access caching and invalidation/notification, not durable subscription truth.

Suggested events:
- `restaurant.subscription.updated`
- `restaurant.entitlements.updated`
- `restaurant.status.updated`
- `restaurant.membership.updated`
- `role.permissions.updated`
- `authorization.version.changed`

Audit subscription, restaurant status, overrides and role-permission changes with actor, target, timestamp, reason and outcome.

## 13. Subscription expiry and data protection

Define policy for each lifecycle state. At minimum:
- `TRIALING`/`ACTIVE`: evaluate plan and overrides.
- `PAST_DUE`: apply approved grace-period policy.
- `CANCELLED`: define immediate versus paid-through access.
- `EXPIRED`: restrict subscription-dependent features.
- `SUSPENDED`: deny restaurant operations according to platform policy.

Expiry/suspension must not delete restaurant data, orders, payments, invoices or audit history. Preserve customer QR/session integrity and define how active orders/sessions are handled.

## 14. Functional requirements and acceptance criteria

| ID | Requirement | Acceptance criterion |
|---|---|---|
| FR-01 | Restaurant approval | Only Super Admin can approve/reject; ID is server-generated and unique |
| FR-02 | Plan management | Super Admin can configure plans and included features |
| FR-03 | Subscription assignment | Plan and lifecycle dates can be assigned to a restaurant |
| FR-04 | Overrides | Override is authorized, time-bounded/reasoned and audited |
| FR-05 | Effective access | Backend checks status, subscription, feature and role privilege |
| FR-06 | Separate dashboards | Each supported role opens its own role-specific shell |
| FR-07 | Dynamic navbar | Only enabled features with required role privilege appear |
| FR-08 | Title bar | Active module/title/actions reflect dashboard context and permissions |
| FR-09 | Branding | Super Admin sees DineFlow; restaurant roles see authorized restaurant name |
| FR-10 | Tenant isolation | Altered tenant IDs cannot access another restaurant's data |
| FR-11 | Revocation | Changes invalidate cached access within the approved target |
| FR-12 | Regression | QR session, customer menu/cart/order, payment and kitchen flows continue |
| FR-13 | Audit | Sensitive administrative changes are attributable and timestamped |
| FR-14 | MCP parity | MCP protected actions use identical authorization rules |

## 15. Non-functional requirements

- Retain RS256/JWKS boundaries and private-key isolation.
- Preserve existing service ownership and Nginx routing.
- Keep access-context payload compact.
- Define cache TTL and revocation latency.
- Log denials without leaking tenant data.
- Validate subscription transitions, dates and limits server-side.
- Keep audit records protected from unauthorized modification.
- Keep role-specific UI responsive.
- Subscription failure must not delete business data.

## 16. Decisions requiring project approval

1. Single-restaurant user versus multi-restaurant memberships.
2. Super Admin account storage model given current `users.restaurant_id NOT NULL`.
3. Plan-change effective timing.
4. `PAST_DUE` grace period.
5. `CANCELLED` paid-through behaviour.
6. Override precedence and whether overrides can disable plan features.
7. Which features ship in release one versus remain catalogue entries for future work.
8. Maximum revocation latency/cache design.
9. Manual subscription administration versus billing-provider integration.
10. Final dashboard routes and visual design.

## 17. Compatibility statement

This enhancement supplies the subscription and access-control foundation for DineFlow's current and future modules. It does not claim that the AI agents, knowledge graph, simulation engine, adaptive menu or kitchen assignment engine have already been implemented. The existing QR-based customer session remains a separate identity type and must continue working.
