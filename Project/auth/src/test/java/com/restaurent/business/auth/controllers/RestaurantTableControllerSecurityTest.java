package com.restaurent.business.auth.controllers;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.UUID;

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

import com.restaurent.business.auth.entities.UserInfo;
import com.restaurent.business.auth.entities.dto.TableResponse;
import com.restaurent.business.auth.services.RestaurantTableService;
import com.restaurent.business.auth.services.TableQrService;
import com.restaurent.business.auth.services.UserInfoDetails;

@ExtendWith(SpringExtension.class)
@SpringJUnitConfig(RestaurantTableControllerSecurityTest.TestConfig.class)
class RestaurantTableControllerSecurityTest {

    @Autowired
    private RestaurantTableController controller;

    @Autowired
    private RestaurantTableService tableService;

    @Test
    @WithMockUser(authorities = "TABLE_MANAGE")
    void tableManagePrivilegeCanReachTableApi() {
        UserInfo user = UserInfo.builder().id(UUID.randomUUID()).restaurantId("restaurant-a").build();
        UserInfoDetails principal = new UserInfoDetails(user);
        when(tableService.get("restaurant-a", UUID.fromString("00000000-0000-0000-0000-000000000001")))
                .thenReturn(new TableResponse(UUID.fromString("00000000-0000-0000-0000-000000000001"),
                        "restaurant-a", 1, 4, null, null,
                        com.restaurent.business.auth.entities.TableStatus.ACTIVE, null, null));

        TableResponse response = controller.get(principal,
                UUID.fromString("00000000-0000-0000-0000-000000000001"));

        assertEquals("restaurant-a", response.restaurantId());
    }

    @Test
    @WithMockUser(authorities = "MENU_READ")
    void requestsWithoutTableManagePrivilegeAreRejected() {
        assertThrows(AccessDeniedException.class,
                () -> controller.list(new UserInfoDetails(UserInfo.builder()
                        .id(UUID.randomUUID()).restaurantId("restaurant-a").build())));
    }

    @Configuration
    @EnableMethodSecurity
    static class TestConfig {
        @Bean
        RestaurantTableService restaurantTableService() {
            return mock(RestaurantTableService.class);
        }

        @Bean
        RestaurantTableController restaurantTableController(RestaurantTableService service) {
            return new RestaurantTableController(service, mock(TableQrService.class));
        }
    }
}
