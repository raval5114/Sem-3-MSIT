# API Documentation

## 1. Controller Endpoints Summary

### `HomeController` (`/`)
| Method | Endpoint | Access Level | Description |
|--------|----------|--------------|-------------|
| `GET`  | `/`      | Authenticated| Returns basic HTML banner (`<h1>Hello World</h1>`) |

### `UserController` (`/auth`)
| Method | Endpoint | Access Level | Description |
|--------|----------|--------------|-------------|
| `GET`  | `/auth/welcome` | Public (`permitAll`) | Returns `"Hello"` text |
| `POST` | `/auth/login` | Public (`permitAll`) | Authenticates user credentials & returns JWT token |

---

## 2. Endpoint Specifications & Payloads

### POST `/auth/login`
Authenticates a user using email and password.

#### Request Body (`application/json`)
```json
{
  "email": "user@example.com",
  "password": "yourpassword"
}
```

#### Success Response (`200 OK`)
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyQGV4YW1wbGUuY29tIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMzYwMDB9...",
  "tokenType": "Bearer"
}
```

#### Unauthorized Response (`401 Unauthorized`) - Invalid Credentials
```json
{
  "error": "BAD_CREDENTIALS",
  "message": "Invalid email or password",
  "status": 401,
  "timestamp": "2026-08-01T12:00:00.000000"
}
```

#### Unauthorized Response (`401 Unauthorized`) - Authentication Failure
```json
{
  "error": "UNAUTHORIZED",
  "message": "Authentication failed",
  "status": 401,
  "timestamp": "2026-08-01T12:00:00.000000"
}
```

---

## 3. Secured API Calls (Bearer Token Usage)

When accessing protected endpoints (e.g. `/`, `/auth/user/*`, `/auth/admin/*`), include the JWT in the `Authorization` request header:

```http
GET / HTTP/1.1
Host: localhost:8080
Authorization: Bearer <YOUR_JWT_TOKEN>
```
