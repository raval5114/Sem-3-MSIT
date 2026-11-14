# Restaurant Registration & Platform Administration API

These APIs extend the existing Auth Service and use its current identity and RBAC tables.

## Public application

`POST /auth/restaurant-registrations` accepts `restaurantName`, `ownerName`, `ownerEmail`, and optional `phone` and `address`. Names and email are normalized, required fields and lengths are validated, and a pending owner-email or restaurant-name duplicate returns `409 Conflict`. Successful submission returns `201 Created` with a generated application UUID and `PENDING` status.

Submission does not create an account, activate a restaurant, or assign a subscription.

## Super Admin operations

All `/auth/platform/**` endpoints require the existing `SUPER_ADMIN` authority. Restaurant Admin and other restaurant roles receive `403 Forbidden`.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/auth/platform/registrations?status=PENDING&query=...&page=0&size=20` | Filter and page applications |
| `POST` | `/auth/platform/registrations/{registrationId}/approve` | Approve a pending application and issue an immutable `DF-` Restaurant ID |
| `POST` | `/auth/platform/registrations/{registrationId}/reject` | Reject a pending application; body requires a reason |
| `GET` | `/auth/platform/restaurants?status=ACTIVE&query=...&page=0&size=20` | Filter and page the restaurant directory |
| `POST` | `/auth/platform/restaurants/{restaurantId}/suspend` | Suspend an active restaurant; body requires a reason |
| `POST` | `/auth/platform/restaurants/{restaurantId}/reactivate` | Reactivate a suspended restaurant |
| `GET` | `/auth/platform/audit-logs?restaurantId=...&resourceType=...&page=0&size=20` | Review paged administrative audit records |

Page size is limited to 100. Review and lifecycle transitions are audited with actor and timestamp. Pending registration decisions and restaurant state changes use optimistic versioning to reject conflicting concurrent updates.

The Auth Service denies login and Auth-owned API access for suspended restaurant staff. Downstream Node services currently validate signed JWTs locally; subscription-aware cross-service enforcement and immediate revocation are part of the effective-authorization work in Phase 4.

Plan, subscription lifecycle, and entitlement override endpoints are documented in [SUBSCRIPTION_PLATFORM_API.md](SUBSCRIPTION_PLATFORM_API.md).
