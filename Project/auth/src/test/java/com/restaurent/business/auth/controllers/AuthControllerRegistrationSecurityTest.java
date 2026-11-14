package com.restaurent.business.auth.controllers;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import com.restaurent.business.auth.services.UserInfoService;

@SpringJUnitConfig(AuthControllerRegistrationSecurityTest.TestConfig.class)
class AuthControllerRegistrationSecurityTest {

    @Autowired
    private AuthController controller;

    @Test
    @WithMockUser(authorities = "RESTAURANT_ADMIN")
    void restaurantAdminCannotProvisionAccountsThroughPlatformEndpoint() {
        assertThrows(AccessDeniedException.class, () -> controller.addNewUser(null));
    }

    @Configuration
    @EnableMethodSecurity
    static class TestConfig {
        @Bean
        UserInfoService userInfoService() {
            return mock(UserInfoService.class);
        }

        @Bean
        AuthController authController() {
            return new AuthController();
        }
    }
}
