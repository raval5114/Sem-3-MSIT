package com.restaurent.business.auth.controllers;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import com.restaurent.business.auth.services.RestaurantAdminService;

@ExtendWith(SpringExtension.class)
@SpringJUnitConfig(RestaurantAdminControllerSecurityTest.TestConfig.class)
class RestaurantAdminControllerSecurityTest {

    @Autowired
    private RestaurantAdminController controller;

    @Test
    @WithMockUser(authorities = "MENU_READ")
    void restaurantAdministrationRequiresStaffManagePrivilege() {
        assertThrows(AccessDeniedException.class, () -> controller.roles());
    }

    @Configuration
    @EnableMethodSecurity
    static class TestConfig {
        @Bean
        RestaurantAdminService restaurantAdminService() {
            return mock(RestaurantAdminService.class);
        }

        @Bean
        RestaurantAdminController restaurantAdminController(RestaurantAdminService service) {
            return new RestaurantAdminController(service);
        }
    }
}
