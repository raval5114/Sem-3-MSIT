package com.restaurent.business.auth.filters;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import com.nimbusds.jose.jwk.RSAKey;
import com.restaurent.business.auth.config.KeyConfig;
import com.restaurent.business.auth.entities.Privilege;
import com.restaurent.business.auth.entities.Role;
import com.restaurent.business.auth.entities.UserInfo;
import com.restaurent.business.auth.services.JwtService;
import com.restaurent.business.auth.services.UserInfoDetails;
import com.restaurent.business.auth.services.UserInfoService;
import org.springframework.security.core.context.SecurityContextHolder;

import jakarta.servlet.ServletException;

class JwtAuthFilterTest {

    @TempDir
    Path keyDirectory;

    @Test
    void publicLoginIgnoresStaleBearerTokenAndContinues() throws ServletException, IOException {
        JwtService jwtService = new JwtService(new KeyConfig(keyDirectory.resolve("current").toString()).rsaKey());
        JwtService oldJwtService = new JwtService(new KeyConfig(keyDirectory.resolve("old").toString()).rsaKey());
        String staleToken = oldJwtService.generateToken("old-staff", Map.of());
        JwtAuthFilter filter = filter(jwtService);
        MockHttpServletRequest request = request("/auth/login", staleToken);
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean continued = new AtomicBoolean(false);

        filter.doFilter(request, response, (servletRequest, servletResponse) -> continued.set(true));

        assertTrue(continued.get());
        assertEquals(200, response.getStatus());
    }

    @Test
    void publicTableSessionInitializationIgnoresStaleBearerTokenAndContinues() throws ServletException, IOException {
        JwtService jwtService = new JwtService(new KeyConfig(keyDirectory.resolve("current-session").toString()).rsaKey());
        JwtService oldJwtService = new JwtService(new KeyConfig(keyDirectory.resolve("old-session").toString()).rsaKey());
        String staleToken = oldJwtService.generateToken("old-staff", Map.of());
        JwtAuthFilter filter = filter(jwtService);
        MockHttpServletRequest request = request("/auth/table-session/init", staleToken);
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean continued = new AtomicBoolean(false);

        filter.doFilter(request, response, (servletRequest, servletResponse) -> continued.set(true));

        assertTrue(continued.get());
        assertEquals(200, response.getStatus());
    }

    @Test
    void protectedRequestWithInvalidSignatureReturnsUnauthorizedAndStopsChain() throws ServletException, IOException {
        JwtService verifyingJwtService = new JwtService(new KeyConfig(keyDirectory.resolve("current").toString()).rsaKey());
        JwtService otherJwtService = new JwtService(new KeyConfig(keyDirectory.resolve("other").toString()).rsaKey());
        String tokenFromOtherKey = otherJwtService.generateToken("staff", Map.of());
        JwtAuthFilter filter = filter(verifyingJwtService);
        MockHttpServletRequest request = request("/auth/user/userProfile", tokenFromOtherKey);
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean continued = new AtomicBoolean(false);

        filter.doFilter(request, response, (servletRequest, servletResponse) -> continued.set(true));

        assertEquals(401, response.getStatus());
        assertFalse(continued.get());
    }

    @Test
    void staffTokenSubjectLoadsByUserIdAndProvidesTablePrivilege() throws ServletException, IOException {
        UUID userId = UUID.randomUUID();
        JwtService jwtService = new JwtService(new KeyConfig(keyDirectory.resolve("staff").toString()).rsaKey());
        UserInfo user = UserInfo.builder()
                .id(userId)
                .email("staff@dineflow.test")
                .restaurantId("restaurant-a")
                .role(Role.builder().name("RESTAURANT_ADMIN")
                        .privileges(java.util.Set.of(Privilege.builder().name("TABLE_MANAGE").build()))
                        .build())
                .build();
        UserInfoDetails principal = new UserInfoDetails(user);
        UserInfoService userInfoService = mock(UserInfoService.class);
        when(userInfoService.loadUserBySubject("u_" + userId)).thenReturn(principal);
        JwtAuthFilter filter = filter(jwtService, userInfoService);
        String token = jwtService.generateToken("u_" + userId, Map.of("email", "staff@dineflow.test"));
        MockHttpServletRequest request = request("/auth/tables", token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean continued = new AtomicBoolean(false);

        try {
            filter.doFilter(request, response, (servletRequest, servletResponse) -> continued.set(true));

            assertTrue(continued.get());
            assertTrue(SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
                    .anyMatch(authority -> authority.getAuthority().equals("TABLE_MANAGE")));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private JwtAuthFilter filter(JwtService jwtService) {
        return filter(jwtService, mock(UserInfoService.class));
    }

    private JwtAuthFilter filter(JwtService jwtService, UserInfoService userInfoService) {
        JwtAuthFilter filter = new JwtAuthFilter();
        ReflectionTestUtils.setField(filter, "jwtService", jwtService);
        ReflectionTestUtils.setField(filter, "userDetailsService", userInfoService);
        return filter;
    }

    private MockHttpServletRequest request(String path, String token) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI(path);
        request.setServletPath(path);
        request.addHeader("Authorization", "Bearer " + token);
        return request;
    }
}
