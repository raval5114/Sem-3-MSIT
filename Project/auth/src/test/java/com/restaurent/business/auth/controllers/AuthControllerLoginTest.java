package com.restaurent.business.auth.controllers;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.util.ReflectionTestUtils;

import com.nimbusds.jose.jwk.RSAKey;
import com.restaurent.business.auth.config.KeyConfig;
import com.restaurent.business.auth.entities.AuthRequest;
import com.restaurent.business.auth.entities.Privilege;
import com.restaurent.business.auth.entities.Role;
import com.restaurent.business.auth.entities.UserInfo;
import com.restaurent.business.auth.entities.dto.LoginSuccessResponse;
import com.restaurent.business.auth.services.JwtService;
import com.restaurent.business.auth.services.UserInfoDetails;

class AuthControllerLoginTest {

    @TempDir
    Path keyDirectory;

    @Test
    void successfulLoginReturnsBearerTokensAndRestaurantRoleClaims() {
        UUID userId = UUID.randomUUID();
        Privilege menuRead = Privilege.builder().id(1).name("MENU_READ").build();
        Role role = Role.builder().id(2).name("RESTAURANT_ADMIN").privileges(Set.of(menuRead)).build();
        UserInfo user = UserInfo.builder()
                .id(userId)
                .name("Restaurant Admin")
                .email("admin@dineflow.test")
                .password("hashed-password")
                .restaurantId("restaurant-test")
                .role(role)
                .isActive(true)
                .build();
        UserInfoDetails principal = new UserInfoDetails(user);
        AuthenticationManager authenticationManager = credentials -> authenticated(principal);
        JwtService jwtService = new JwtService(new KeyConfig(keyDirectory.toString()).rsaKey());
        AuthController controller = controller(authenticationManager, jwtService);

        LoginSuccessResponse response = controller.authenticateAndGetToken(
                new AuthRequest("admin@dineflow.test", "correct-password"));

        assertEquals("Login successful", response.getMessage());
        assertNotNull(response.getToken());
        assertNotNull(response.getRefreshToken());
        assertEquals("Bearer", response.getTokenType());
        assertEquals(900, response.getExpiresIn());
        assertEquals("u_" + userId, jwtService.extractUsername(response.getToken()));
        assertEquals("admin@dineflow.test", claim(jwtService, response, "email"));
        assertEquals("restaurant-test", claim(jwtService, response, "restaurantId"));
        assertEquals(List.of("RESTAURANT_ADMIN"), jwtService.extractClaim(response.getToken(), claims -> claims.get("roles", List.class)));
        assertEquals(List.of("MENU_READ"), jwtService.extractClaim(response.getToken(), claims -> claims.get("privileges", List.class)));
    }

    @Test
    void rejectedCredentialsDoNotIssueAccessToken() {
        AuthenticationManager authenticationManager = credentials -> {
            throw new BadCredentialsException("Bad credentials");
        };
        JwtService jwtService = new JwtService(new KeyConfig(keyDirectory.toString()).rsaKey());
        AuthController controller = controller(authenticationManager, jwtService);

        assertThrows(BadCredentialsException.class, () -> controller.authenticateAndGetToken(
                new AuthRequest("admin@dineflow.test", "wrong-password")));
    }

    private AuthController controller(AuthenticationManager authenticationManager, JwtService jwtService) {
        AuthController controller = new AuthController();
        ReflectionTestUtils.setField(controller, "authenticationManager", authenticationManager);
        ReflectionTestUtils.setField(controller, "jwtService", jwtService);
        return controller;
    }

    private Authentication authenticated(UserDetails principal) {
        return UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities());
    }

    private String claim(JwtService jwtService, LoginSuccessResponse response, String name) {
        return jwtService.extractClaim(response.getToken(), claims -> claims.get(name, String.class));
    }
}
