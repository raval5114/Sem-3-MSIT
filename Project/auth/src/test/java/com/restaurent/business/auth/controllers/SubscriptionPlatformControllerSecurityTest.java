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

import com.restaurent.business.auth.services.SubscriptionPlatformService;

@SpringJUnitConfig(SubscriptionPlatformControllerSecurityTest.TestConfig.class)
class SubscriptionPlatformControllerSecurityTest {

    @Autowired
    private SubscriptionPlatformController controller;

    @Test
    @WithMockUser(authorities = "RESTAURANT_ADMIN")
    void restaurantAdminCannotReadPlatformPlanCatalog() {
        assertThrows(AccessDeniedException.class, () -> controller.plans());
    }

    @Test
    @WithMockUser(authorities = "SUPER_ADMIN")
    void superAdminCanReadPlatformFeatureCatalog() {
        controller.features();
    }

    @Configuration
    @EnableMethodSecurity
    static class TestConfig {
        @Bean
        SubscriptionPlatformService subscriptionPlatformService() {
            return mock(SubscriptionPlatformService.class);
        }

        @Bean
        SubscriptionPlatformController subscriptionPlatformController(
                SubscriptionPlatformService subscriptionPlatformService) {
            return new SubscriptionPlatformController(subscriptionPlatformService);
        }
    }
}
