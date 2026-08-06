# Application Context Index

This directory (`/context`) contains full documentation for the **Spring Security Learning Application**.

## Documentation Files

1. [APPLICATION_CONTEXT.md](file:///d:/springboot/springseclearning/context/APPLICATION_CONTEXT.md)
   - High-level overview
   - Tech stack & dependencies
   - Project directory breakdown
   - Architectural flow diagram
   - Security strategy & circular dependency resolution

2. [ARCHITECTURE.md](file:///d:/springboot/springseclearning/context/ARCHITECTURE.md)
   - Spring Security Filter Chain specification (`JwtAuthFilter`, `SecurityConfig`)
   - MySQL / Hibernate entity mapping (`UserInfo`)
   - Repository interfaces (`UserDetailsRepository`)
   - Service layer implementations (`JwtService`, `UserInfoService`, `UserInfoDetails`)
   - Data Transfer Objects (DTOs)

3. [API_DOCS.md](file:///d:/springboot/springseclearning/context/API_DOCS.md)
   - Complete REST API endpoint directory (`/auth/login`, `/auth/welcome`, `/`)
   - Request and response JSON schema examples
   - Standardized success and error payloads (`LoginSuccessResponse`, `ErrorResponse`)
   - Bearer token authentication header usage
