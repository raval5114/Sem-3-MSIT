package com.restaurent.business.auth.controllers;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.restaurent.business.auth.entities.dto.TableResponse;
import com.restaurent.business.auth.services.RestaurantTableService;
import com.restaurent.business.auth.services.UserInfoDetails;

@RestController
@RequestMapping("/auth/waiter")
@PreAuthorize("hasAuthority('WAITER') and hasAuthority('ORDER_READ_ACTIVE')")
public class WaiterTableController {

    private final RestaurantTableService tableService;

    public WaiterTableController(RestaurantTableService tableService) {
        this.tableService = tableService;
    }

    @GetMapping("/tables")
    public List<TableResponse> assignedTables(@AuthenticationPrincipal UserInfoDetails staff) {
        return tableService.assignedToWaiter(
                staff.getUserInfo().getRestaurantId(), staff.getUserInfo().getId());
    }
}
