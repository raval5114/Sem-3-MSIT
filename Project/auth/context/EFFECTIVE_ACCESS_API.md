# Effective Access API and Service Policy

The Auth Service is the source of truth for staff access. It resolves the user from the verified JWT subject, then loads current restaurant membership, restaurant status, subscription snapshot, valid overrides, feature status, and RBAC authorities from PostgreSQL. JWT role and privilege claims are not used to authorize downstream staff operations.

## Authenticated access-context endpoints

All endpoints require the caller's staff bearer token. They are served under the existing Auth Service `/auth` mapping:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/auth/access/context` | Return role, trusted restaurant identity, subscription state, features, permissions, authorization versions, and navigation |
| `GET` | `/auth/access/features` | Return the effective feature map |
| `GET` | `/auth/access/navigation` | Return navigation entries for currently enabled features |
| `POST` | `/auth/access/authorize` | Check one feature and one RBAC permission for a downstream operation |

Example authorization request:

```json
{
  "featureKey": "ORDER_MANAGEMENT",
  "permission": "ORDER_UPDATE_STATUS",
  "restaurantId": "DF-<restaurant-id>"
}
```

`restaurantId` is optional but, when supplied by a downstream service, must equal the restaurant assigned to the authenticated user. The server never uses it to select a different tenant.

Allowed response:

```json
{
  "allowed": true,
  "code": "ALLOWED",
  "message": "Access granted.",
  "context": {
    "displayName": "Kitchen Staff",
    "email": "staff@example.test",
    "role": "CHEF",
    "restaurantId": "DF-<restaurant-id>",
    "permissions": ["ORDER_READ_ACTIVE", "ORDER_UPDATE_STATUS"]
  }
}
```

Denied requests return HTTP 403 with `allowed: false` and a stable reason code, such as `USER_INACTIVE`, `CROSS_TENANT_FORBIDDEN`, `RESTAURANT_INACTIVE`, `SUBSCRIPTION_REQUIRED`, `SUBSCRIPTION_INACTIVE`, `FEATURE_DISABLED`, or `PERMISSION_DENIED`. An Auth outage is not converted into an allow response; downstream services return 503 and fail closed.

## Effective-access rules

The access decision requires all of the following:

1. The current Auth user is active and belongs to the resolved restaurant.
2. The restaurant status is `ACTIVE`.
3. The latest open subscription permits access: `TRIALING` before `trialEndsAt`, `ACTIVE` before `currentPeriodEnd`, `PAST_DUE` before `gracePeriodEndsAt`, or `CANCELLED` before the paid-through `currentPeriodEnd`. Suspended, expired, missing, and not-yet-started subscriptions deny access.
4. The feature is active and enabled by the subscription's assignment-time snapshot or the latest currently valid override. Overrides take precedence over the snapshot.
5. The current database-backed role grants the requested privilege. A feature entitlement does not grant a role permission.

The current navigation metadata maps enabled features to UI paths; it is a presentation hint, not an authorization boundary.

## Downstream integration and customer sessions

Menu management, staff order operations, and payment operations forward the caller's bearer token to `/auth/access/authorize` for each staff operation. They fail closed when Auth is unavailable. Menu writes stamp the restaurant ID from the returned context and scope document lookups and mutations to that restaurant. Public customer catalog access remains on its existing route.

Notification sockets use the same policy for kitchen access. A staff socket can only join its own restaurant kitchen room; a customer socket remains scoped to its own table-session room. Arbitrary room joins are rejected.

Customer table-session tokens do not authenticate to staff access-context endpoints and continue using the existing QR/table-session flow. Payment verification and payment-history reads additionally remain scoped to the token's restaurant and table session. Webhooks continue to use their provider signature rather than a user bearer token.

## Revocation, versions, and Redis

No access-result cache is used. Each downstream staff operation checks Auth and Auth reads the authoritative database, so role revocation, restaurant suspension, subscription expiry, and override changes take effect on the next checked operation; no cache TTL or cache key is part of the authorization boundary.

`authorization_versions` records `USER`, `RESTAURANT`, `ROLE`, and `FEATURE` generations. Restaurant registration/lifecycle, subscription lifecycle, override, role/privilege, and feature mutations increment the relevant generation in the same database transaction. Successful mutations publish JSON events to the Redis channel `dineflow:authorization:invalidations` after commit. Redis publication failure is logged and does not roll back a completed database change. Since no service caches authorization decisions, duplicate, delayed, or missed Pub/Sub events cannot grant access; consumers must query the authoritative policy before any future cached/tool integration.

Plan changes do not modify an existing subscription's assignment-time entitlement snapshot, by design. A new assignment invalidates the restaurant generation. Feature activation changes invalidate the feature generation and are enforced by live checks.

There are no MCP/tool operations in the current repository. Any future MCP integration must call this same Auth API and must not read authorization tables directly.
