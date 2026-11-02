# DineFlow Authentication Test Checklist

Feature contract: [`auth_login.feature`](../features/auth_login.feature). Automated tests are in `src/test/java/com/restaurent/business/auth/` and run with `mvn test` from `Project/auth`.

Latest automated run: **6 tests passed, 0 failed**. The database-backed Spring context smoke test is skipped unless `-Dauth.integration=true` is supplied.

## Login workflow

| # | Workflow step | Expected result | Result |
|---|---|---|---|
| 1 | Submit valid email and password | Authentication manager accepts the credentials | ☐ |
| 2 | Resolve account identity | Token subject is `u_<user UUID>` and claims include email, restaurant ID, role, and privileges | ☐ |
| 3 | Return login response | Response has access token, refresh token, `Bearer` type, and 900-second expiry | ☐ |
| 4 | Submit invalid credentials | Login is rejected and no JWT is generated | ☐ |
| 5 | Submit login with a stale browser token | Public login ignores stale `Authorization` header and accepts valid credentials | ☐ |
| 6 | Recreate auth container with same named volume | RSA key and JWKS `kid` remain stable; prior unexpired tokens remain verifiable | ☐ |
| 7 | Send a foreign-key token to a protected path | Auth filter returns 401 without a signature stack trace or downstream filter call | ☐ |
| 8 | Call gateway `/api/v1/auth/login` | Nginx forwards to controller path `/auth/login` | ☐ |

## Automated case coverage

| Case | Automated check | Status |
|---|---|---|
| Key continuity | Reload key pair from a new `KeyConfig` instance and verify a token issued by the first instance | Passed |
| Key mismatch | A token signed by another RSA key is rejected | Passed |
| Stale token on login | `JwtAuthFilter` bypasses bearer parsing for login and other public auth paths | Passed |
| Invalid token on protected endpoint | Filter returns HTTP 401 and stops the filter chain | Passed |
| Login token claims | Controller issues the expected response and identity/role claims after successful authentication | Passed |
| Invalid password | Controller does not issue a JWT when the authentication manager rejects credentials | Passed |

## Docker and browser follow-up

The signing key is persisted in the Compose volume `auth_jwt_keys`, mounted at `/var/lib/dineflow/auth-keys`. Rebuild/recreate the service without deleting volumes:

```powershell
docker compose up -d --build --force-recreate auth-service
```

Do not use `docker compose down -v` unless intentionally rotating the signing key. The browser may retain an old token; the public login route must still accept valid credentials when that stale token is sent. The React auth client now omits the bearer token on public auth requests.

The gateway auth route is expected to forward `/api/v1/auth/login` to `/auth/login`, matching the controller mapping.

## Scope note

The Maven unit suite uses temporary key directories and an in-memory `AuthenticationManager`, so it does not require PostgreSQL or Docker. `AuthApplicationTests` is a separate opt-in Spring context check because it needs a running PostgreSQL instance. To run it explicitly, use `mvn test -Dauth.integration=true` after starting the dependencies.

The production login endpoint still returns a random placeholder refresh token; it is not persisted, rotated, or exchangeable because refresh-token storage and `/auth/refresh` are not implemented yet. The tests verify the current login response contract, not refresh-token rotation.
