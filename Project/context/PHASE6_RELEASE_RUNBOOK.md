# DineFlow Phase 6 Release Runbook

This runbook covers the local Compose deployment. A production release still requires an owner-approved environment, approved subscription policy and plan matrices, production secrets, and an authorized deployer.

## Pre-release checks

1. Obtain approval for trial duration, past-due grace, cancellation timing, and each plan's feature/limit matrix. The current 14-day trial and 7-day grace defaults are provisional.
2. Build and run the Auth, Menu, Order, Payment, Notification, and frontend checks from their service directories. Record the exact commit, command, date, and result.
3. Confirm `.env` and `auth/admin.seed` are present on the deployment host, are not committed, and contain deployment-specific credentials. Rotate any example or development credentials.
4. Confirm PostgreSQL migrations are additive and reviewed. The Auth Service uses Flyway and Hibernate schema validation; do not apply a destructive schema rollback during an application rollback.
5. Confirm public traffic enters through the intended gateway/PWA proxy. Compose binds database and service ports to loopback; the PWA and gateway ports remain externally reachable for QR access and app traffic.

## Backup and restore rehearsal

Take backups before migrations and retain checksums and restore logs with the release record. Run restores into isolated disposable databases first.

```bash
# PostgreSQL logical backup
docker compose exec -T postgres-db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > scdp-postgres.dump

# MongoDB menu catalogue backup
docker compose exec -T mongo-db mongodump --archive --gzip --db scdp_menu > scdp-menu.archive.gz

# Verify PostgreSQL archive readability
pg_restore --list scdp-postgres.dump

# Restore only into an isolated disposable PostgreSQL database
cat scdp-postgres.dump | docker compose exec -T -e RESTORE_DATABASE=dineflow_restore postgres-db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$RESTORE_DATABASE" --no-owner'

# Restore only into an isolated disposable MongoDB instance
cat scdp-menu.archive.gz | docker compose exec -T mongo-db mongorestore --archive --gzip --nsInclude='scdp_menu.*'
```

Create the disposable `dineflow_restore` database before using that restore command. Never test restore commands against the active production database. Add encryption, access controls, retention, and off-host storage in the production backup system.

## Deployment sequence

1. Announce the maintenance window and confirm the previous application image tags and current database backup are available.
2. Deploy the Auth Service first so its additive Flyway migrations complete before dependent services use the new authorization contract.
3. Deploy Menu, Order, Payment, and Notification services, then the frontend and gateway configuration.
4. Confirm database and service health, Auth `/actuator/health`, Menu `/health`, and the PWA login/registration routes.
5. Run the authorized smoke scenarios below with designated test accounts. Do not use real customer payment credentials.
6. Watch authorization denial/rate-limit counters, subscription transition counters, application logs, scheduler activity, and service health for the agreed observation window.

## Smoke and regression scenarios

- Submit a restaurant application, approve it with a Super Admin, and confirm the server-generated Restaurant ID.
- Assign the owner-approved plan, verify enabled and disabled feature behavior, then verify a time-bounded override expires as expected.
- Revoke a test user's permission and verify the next protected request is denied.
- Suspend a test restaurant and verify staff APIs reject requests; verify a Restaurant Admin cannot access platform APIs.
- Attempt cross-tenant reads and writes for staff, tables, orders, subscriptions, and restaurant settings; each must be denied without disclosing another tenant's data.
- Exercise Super Admin, Restaurant Admin, Waiter, Chef/Kitchen Staff, and Cashier dashboards and direct-route guards.
- Complete QR initialization, customer menu browsing, cart/order submission, payment sandbox settlement, kitchen update, and waiter assignment flows.
- Confirm public registration and login rate limits return HTTP 429 after their configured window limits; confirm Redis unavailability fails closed with HTTP 503 for those protected entry points.

## Rollback

1. Stop the rollout if smoke checks fail or authorization errors rise above the agreed threshold.
2. Roll application images and gateway configuration back to the previous known-good tags while keeping additive database migrations in place.
3. Re-run health checks and the affected customer/staff flows.
4. Restore a database backup only when forward recovery is not viable and an incident owner has approved the data-loss window. Restore to a separate instance first and document the reconciliation plan.
5. Prefer a forward Flyway migration for schema corrections. Flyway Community has no automatic undo migrations; do not delete migration history or drop newly added tables as routine rollback steps.
6. Record the incident, image tags, migration versions, backup identifiers, recovery actions, and follow-up owner.

## Release record

The release owner must attach the test report, security review, backup/restore rehearsal evidence, monitoring window results, migration versions, and approval of provisional product policies. Deployment and product-owner approval are external release actions; this repository does not claim they have occurred.
