Feature: DineFlow staff authentication and JWT issuance
  The auth service authenticates a staff account, returns a short-lived RS256
  access token, and publishes the matching public key through JWKS.

  Scenario: Sign in with valid credentials
    Given an active staff account exists with a restaurant role
    When the account submits its valid email and password
    Then authentication succeeds
    And the response contains a bearer access token and refresh token
    And the access token contains the account identity, restaurant, roles, and privileges

  Scenario: Reject invalid credentials
    Given an active staff account exists
    When the account submits an incorrect password
    Then authentication is rejected
    And no access token is issued

  Scenario: Allow sign in when the browser sends a stale bearer token
    Given the browser still stores a token signed by a previous auth key
    When the browser submits valid credentials to the public login endpoint
    Then the auth filter ignores the stale bearer token for that public endpoint
    And authentication returns a newly signed access token

  Scenario: Keep signing keys stable when the auth container restarts
    Given the auth service has generated its RSA signing key pair
    When the service is restarted with the same persistent key volume
    Then the JWKS key identifier and public key remain unchanged
    And a token signed before restart remains verifiable

  Scenario: Reject a token signed by an unknown key on a protected endpoint
    Given a protected endpoint receives a token signed by a different key
    When the auth filter verifies the token
    Then the response is unauthorized
    And the filter does not continue the protected request

  Scenario: Route the gateway login path to the auth controller
    Given the client posts to /api/v1/auth/login through the gateway
    When Nginx forwards the request to auth-service
    Then the forwarded path is /auth/login
