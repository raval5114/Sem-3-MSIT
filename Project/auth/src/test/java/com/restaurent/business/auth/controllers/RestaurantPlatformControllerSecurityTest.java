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

import com.restaurent.business.auth.services.RestaurantPlatformService;

@SpringJUnitConfig(RestaurantPlatformControllerSecurityTest.TestConfig.class)
class RestaurantPlatformControllerSecurityTest {

    @Autowired
    private RestaurantPlatformController controller;

    @Test
    @WithMockUser(authorities = "RESTAURANT_ADMIN")
    void restaurantAdminCannotListPlatformRegistrations() {
        assertThrows(AccessDeniedException.class, () -> controller.registrations(null, null, 0, 20));
    }

    @Test
    @WithMockUser(authorities = "SUPER_ADMIN")
    void superAdminCanReachPlatformRegistrationList() {
        controller.registrations(null, null, 0, 20);
    }

    @Configuration
    @EnableMethodSecurity
    static class TestConfig {
        @Bean
        RestaurantPlatformService restaurantPlatformService() {
            return mock(RestaurantPlatformService.class);
        }

        @Bean
        RestaurantPlatformController restaurantPlatformController(RestaurantPlatformService service) {
            return new RestaurantPlatformController(service);
        }
    }
}
