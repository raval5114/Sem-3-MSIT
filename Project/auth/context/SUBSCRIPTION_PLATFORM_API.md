# Subscription, Plan, and Entitlement Administration API

These endpoints extend the Auth Service platform API and require the existing `SUPER_ADMIN` authority. They use the existing feature catalogue, PostgreSQL subscription records, and audit/event tables; they do not create a second RBAC model.

## Features and plans

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/auth/platform/features` | Read stable feature keys and metadata |
| `POST` | `/auth/platform/features` | Add a feature |
| `PUT` | `/auth/platform/features/{featureKey}` | Update metadata/active state; the key cannot change |
| `GET` | `/auth/platform/plans` | Read plans and their feature/limit mappings |
| `POST` | `/auth/platform/plans` | Create a plan and its feature mappings |
| `PUT` | `/auth/platform/plans/{planId}` | Update a plan and replace its feature mappings |

Plan requests contain a `features` array with `featureKey`, `enabled`, and optional JSON `limits`. Unknown keys, duplicate mappings, enabling inactive features, and limits on features that do not support limits are rejected. Feature and plan keys are permanent; deactivate rather than delete or reuse them.

**Existing subscriber rule:** Assignments store a JSON snapshot of the plan's enabled state and limits. Later edits to the plan do not silently change existing subscriptions. Reassigning requires the current open subscription to be ended first. No commercial package/pricing or plan-feature matrix is seeded; platform administrators configure approved values.

## Subscription lifecycle

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/auth/platform/restaurants/{restaurantId}/subscriptions` | Read subscription history |
| `POST` | `/auth/platform/restaurants/{restaurantId}/subscriptions` | Assign an active plan as `TRIALING` or `ACTIVE` |
| `PUT` | `/auth/platform/subscriptions/{subscriptionId}/status` | Request a validated lifecycle transition |

The initial status defaults to `TRIALING`. The implementation defaults to a one-time 14-day trial, a seven-day `PAST_DUE` grace period, and cancellation at paid-through (`currentPeriodEnd`). These are provisional product policies and require owner approval before production release. Monthly/annual active periods are calculated from UTC calendar dates; custom active periods require an explicit future end timestamp.

Allowed administrator transitions:

- `TRIALING` → `ACTIVE`, `CANCELLED`, or `SUSPENDED`
- `ACTIVE` → `PAST_DUE`, `CANCELLED`, or `SUSPENDED`
- `PAST_DUE` → `ACTIVE`, `CANCELLED`, or `SUSPENDED`
- `CANCELLED` → `ACTIVE` (before paid-through) or `SUSPENDED`
- `SUSPENDED` → `ACTIVE`, `PAST_DUE`, or `CANCELLED`
- `EXPIRED` is terminal; the scheduler is the only transition to `EXPIRED`.

The scheduled expiry scan runs once per minute by default and can be tuned with `platform.subscription.expiry-scan-ms`. It processes batches of 100, expires ended trials and paid periods and elapsed past-due grace periods, and records the transition in both `subscription_events` and `audit_logs`. Optimistic versioning and status re-checks make retries safe. This service does not collect payments or automatically renew subscriptions.

## Restaurant-specific overrides

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/auth/platform/restaurants/{restaurantId}/overrides` | Read override history |
| `POST` | `/auth/platform/restaurants/{restaurantId}/overrides` | Create an enable/disable override |
| `PUT` | `/auth/platform/overrides/{overrideId}` | Update an unrevoked override |
| `POST` | `/auth/platform/overrides/{overrideId}/revoke` | Revoke with a required reason |

Each override has a required reason and a validity window. Only unrevoked overrides with `validFrom <= now` and no `validUntil` or `validUntil > now` participate in resolution. The latest `validFrom` wins, with latest creation time breaking ties; this explicit enable/disable decision takes precedence over the plan entitlement. All mutations are audited and invalidate the restaurant authorization version. Effective authorization is documented in [EFFECTIVE_ACCESS_API.md](EFFECTIVE_ACCESS_API.md).

## Validation and tests

The APIs validate lifecycle transitions and request constraints in the service/controller layers. `SubscriptionPlatformServiceTest` covers plan snapshots, grace periods, invalid transitions, expiry retry behavior, override revocation, and invalid feature/limit references. Controller method-security tests verify that restaurant administrators cannot read platform plan data.
