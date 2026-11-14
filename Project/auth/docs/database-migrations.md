# Auth Service database migrations

The Auth Service uses Flyway for additive PostgreSQL schema changes. `V1__subscription_platform_foundation.sql` introduces the restaurant, registration, feature, plan, subscription, override, audit, event, and authorization-version tables. V2 adds database-enforced duplicate-pending-application keys, V3 adds optimistic lifecycle/review versioning, V4 snapshots current plan entitlements onto existing subscriptions, V5 adds optimistic subscription versioning, and V6 adds optimistic authorization-version row updates and the feature invalidation scope. The migrations do not recreate or alter the existing `users`, `roles`, `privileges`, or `role_privileges` tables.

On an existing DineFlow database, Flyway baselines the current Hibernate-managed schema at version `0`, then applies versioned migrations. The first migration copies existing restaurant identifiers from `users`, `restaurant_tables`, and `table_sessions` into `restaurants` as active records; names temporarily use the existing identifier because the current schema has no authoritative restaurant name. Existing rows are not rewritten or deleted. New installations create this foundation before Hibernate creates the existing Auth/RBAC tables.

Feature seed rows cover capabilities already represented by current DineFlow flows. Plan definitions and plan-feature matrices are intentionally not seeded until their business entitlements are approved. RBAC remains in the existing tables.

## Migration safety and rollback

Flyway Community does not execute undo migrations. Before applying a migration to a non-disposable database, take a PostgreSQL backup and review the SQL. V1-V6 are additive and can be rolled back manually only after the new feature is disabled and any data written to these tables has been exported or explicitly approved for removal. For only Phase 3 rollback, remove `restaurant_subscriptions.version` and `restaurant_subscriptions.entitlements_snapshot` after exporting snapshot data, then remove only successful V4/V5 rows from `flyway_schema_history`. A full foundation rollback additionally removes V2's two pending-registration indexes, V3's `restaurants.version` and `restaurant_registrations.version` columns, and V6's authorization-version constraint and `row_version` column first, then drops dependent tables (`subscription_events`, `plan_features`, `entitlement_overrides`, `restaurant_subscriptions`, `restaurant_registrations`, `audit_logs`, `authorization_versions`, `subscription_plans`, `features`, then `restaurants`). Retain any baseline row and do not roll back migrations while later versions depend on them. Never remove pre-existing Auth/RBAC tables or legacy restaurant data that has been backfilled.

Tests using H2 disable Flyway because the migration intentionally uses PostgreSQL types and procedural SQL. Validate migrations against PostgreSQL for both an empty database and a disposable copy of the pre-migration schema before production rollout.

## Phase 1 validation record

Validated with PostgreSQL 16 on 02 November 2026:

- Clean install: Flyway V1 succeeded, the seven current-feature catalogue rows were present, and no legacy restaurants were fabricated.
- Legacy upgrade: one existing user, RBAC role/privilege link, restaurant table, table session, and order row were preserved; the legacy restaurant identifier was backfilled once as active.
- Catalog checks: restaurant/plan/feature foreign keys and the one-open-subscription-per-restaurant unique index were present.
- Auth Service tests: 29 run, 28 passed, zero failed, one opt-in integration test skipped.

Phase 2 migrations V1-V3 were also applied together to a clean PostgreSQL 16 database; all three versions succeeded, seven current-feature rows were present, both pending-registration indexes were created, and version columns were present on both lifecycle entities.

## Phase 2 validation record

- Auth Service tests: 35 run, 34 passed, zero failed, one opt-in integration test skipped.
- Frontend production build and lint of all changed frontend files passed.
- Repository-wide frontend lint remains blocked by pre-existing errors in generated `dev-dist` files and existing menu/KDS components.
- The Phase 2 completion gate remains open for suspended-restaurant enforcement in downstream Node services; immediate enforcement in Auth Service login and protected APIs is implemented. Shared effective authorization and downstream checks remain Phase 4 work.

## Phase 3 validation record

- Auth Service tests: 60 run, 59 passed, zero failed, one opt-in integration test skipped.
- Frontend production build/type-check and lint of the changed platform/dashboard service files passed.
- PostgreSQL 16 clean-install validation applied V1-V5 and confirmed that V4 backfills existing plan-feature entitlements into subscription snapshots and V5 initializes subscription versioning.
- Plan matrices remain admin-configurable and intentionally unseeded; subscription policies (14-day one-time trial, seven-day grace, paid-through cancellation) are provisional pending owner approval before production.
- The Phase 3 API contract is documented in [SUBSCRIPTION_PLATFORM_API.md](../context/SUBSCRIPTION_PLATFORM_API.md).
