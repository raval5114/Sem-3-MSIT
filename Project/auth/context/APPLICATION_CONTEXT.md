# Spring Security Learning Application Context

## 1. Overview
`springseclearning` is a Spring Boot application designed to demonstrate and implement stateless JWT (JSON Web Token) authentication and role-based authorization using **Spring Security 6+ / Spring Boot 4.0.7**.

The application uses **MySQL / MariaDB** (via XAMPP) for database storage and **Spring Data JPA** for data access.

---

## 2. Technology Stack & Dependencies

- **Java**: Version 17
- **Framework**: Spring Boot 4.0.7
  - `spring-boot-starter-webmvc` - Web MVC REST controllers
  - `spring-boot-starter-security` - Spring Security architecture
  - `spring-boot-starter-data-jpa` - JPA / Hibernate ORM persistence layer
  - `spring-boot-starter-test` - Unit & integration testing
- **Database & Persistence**:
  - MySQL / MariaDB (Driver: `com.mysql.cj.jdbc.Driver`)
  - H2 Database (Test scope)
  - Hibernate 7 (`spring.jpa.hibernate.ddl-auto=update`)
- **Security & Tokens**:
  - `io.jsonwebtoken:jjwt-api`, `jjwt-impl`, `jjwt-jackson` (v0.11.5)
- **Utilities**:
  - Lombok (`@Data`, `@AllArgsConstructor`, `@NoArgsConstructor`, `@Builder`)

---

## 3. Directory & Package Structure

```
d:/springboot/springseclearning/
├── context/                             # System Context & Technical Documentation
├── src/
│   ├── main/
│   │   ├── java/com/springseclearning/springseclearning/
│   │   │   ├── config/
│   │   │   │   ├── AppConfig.java       # Standalone PasswordEncoder configuration
│   │   │   │   └── SecurityConfig.java  # Spring Security filter chain & authorization rules
│   │   │   ├── controllers/
│   │   │   │   ├── HomeController.java  # Root endpoint ("/")
│   │   │   │   └── UserController.java  # Public auth endpoints (/auth/welcome, /auth/login)
│   │   │   ├── entities/
│   │   │   │   ├── AuthRequest.java     # Authentication payload entity
│   │   │   │   ├── UserInfo.java        # JPA entity mapping `user_info` database table
│   │   │   │   └── dto/
│   │   │   │       ├── ErrorResponse.java        # Standardized error payload DTO
│   │   │   │       ├── LoginSuccessResponse.java # Token response DTO
│   │   │   │       └── UserRequest.java          # User login payload DTO
│   │   │   ├── filters/
│   │   │   │   └── JwtAuthFilter.java   # Custom OncePerRequestFilter for Bearer token validation
│   │   │   ├── repos/
│   │   │   │   ├── UserDetailsRepository.java # JPA Repository for UserInfo (findByemail)
│   │   │   │   └── UserRepo.java               # JPA Repository variant for UserInfo
│   │   │   ├── services/
│   │   │   │   ├── JwtService.java      # HMAC-SHA256 JWT generation & validation logic
│   │   │   │   ├── UserInfoDetails.java  # Custom UserDetails implementation
│   │   │   │   ├── UserInfoService.java  # Implementation of UserDetailsService
│   │   │   │   └── UserInfoServicePrac.java # Practice/experimental service
│   │   │   └── SpringseclearningApplication.java # Main application bootstrap
│   │   └── resources/
│   │       ├── application.properties    # DataSource, JPA & logging configuration
│   │       ├── HomeController.http       # HTTP client request samples
│   │       └── UserController.http       # HTTP client auth request samples
│   └── test/                             # Application test suites
├── pom.xml                               # Maven build configuration
└── context/                              # Context documentation directory
```

---

## 4. Architectural Summary

```
                       ┌─────────────────────────────────────┐
                       │           HTTP Client               │
                       └──────────────────┬──────────────────┘
                                          │
                                          ▼
                       ┌─────────────────────────────────────┐
                       │           JwtAuthFilter             │
                       │ (Extracts Bearer Token & Validates) │
                       └──────────────────┬──────────────────┘
                                          │
                                          ▼
                       ┌─────────────────────────────────────┐
                       │     Spring Security Filter Chain    │
                       │   (Stateless Session / Authorization)│
                       └──────────────────┬──────────────────┘
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    ▼                                           ▼
       ┌────────────────────────┐                  ┌────────────────────────┐
       │     UserController     │                  │     HomeController     │
       │ (/auth/login, /welcome)│                  │          ("/")         │
       └────────────┬───────────┘                  └────────────────────────┘
                    │
                    ▼
       ┌────────────────────────┐
       │ AuthenticationManager  │
       └────────────┬───────────┘
                    │
                    ▼
       ┌────────────────────────┐
       │ DaoAuthenticationProv. │
       └────────────┬───────────┘
                    │
                    ▼
       ┌────────────────────────┐
       │   UserInfoService      │
       │ (UserDetailsService)   │
       └────────────┬───────────┘
                    │
                    ▼
       ┌────────────────────────┐
       │ UserDetailsRepository  │ ──► MySQL / MariaDB (user_info table)
       └────────────────────────┘
```

---

## 5. Security & Circular Dependency Resolution

### Circular Dependency Avoidance
- **`AppConfig`**: Declares `@Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }`.
- **`SecurityConfig`**: Consumes `PasswordEncoder` alongside `UserDetailsService` and `JwtAuthFilter`.
- Separating `PasswordEncoder` into `AppConfig` prevents circular dependency loops between `UserDetailsService`, `JwtAuthFilter`, and `SecurityConfig`.

### Stateless JWT Strategy
- **Session Policy**: `SessionCreationPolicy.STATELESS`
- **CSRF**: Disabled (not required for stateless bearer authentication).
- **Token Signing**: HMAC-SHA256 with auto-generated 256-bit `SecretKey` in `JwtService`.
- **Token Expiration**: 10 Hours (`1000 * 60 * 60 * 10` milliseconds).
