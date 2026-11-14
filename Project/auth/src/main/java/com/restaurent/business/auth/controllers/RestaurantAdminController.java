package com.restaurent.business.auth.controllers;

import java.util.List;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import com.restaurent.business.auth.entities.dto.RestaurantSettingsRequest;
import com.restaurent.business.auth.entities.dto.RestaurantSettingsResponse;
import com.restaurent.business.auth.entities.dto.RolePermissionsResponse;
import com.restaurent.business.auth.entities.dto.StaffRequest;
import com.restaurent.business.auth.entities.dto.StaffResponse;
import com.restaurent.business.auth.entities.dto.StaffStatusRequest;
import com.restaurent.business.auth.services.RestaurantAdminService;
import com.restaurent.business.auth.services.UserInfoDetails;

@RestController
@RequestMapping("/auth/admin")
@PreAuthorize("hasAuthority('RESTAURANT_ADMIN') and hasAuthority('STAFF_MANAGE')")
public class RestaurantAdminController {

    private final RestaurantAdminService adminService;

    public RestaurantAdminController(RestaurantAdminService adminService) {
        this.adminService = adminService;
    }

    @GetMapping("/restaurant")
    public RestaurantSettingsResponse settings(@AuthenticationPrincipal UserInfoDetails staff) {
        return adminService.settings(restaurantId(staff));
    }

    @PutMapping("/restaurant")
    public RestaurantSettingsResponse updateSettings(
            @AuthenticationPrincipal UserInfoDetails staff,
            @Valid @RequestBody RestaurantSettingsRequest request) {
        return adminService.updateSettings(restaurantId(staff), staff.getUserInfo().getId(), request);
    }

    @GetMapping("/staff")
    public List<StaffResponse> staff(@AuthenticationPrincipal UserInfoDetails principal) {
        return adminService.staff(restaurantId(principal));
    }

    @PostMapping("/staff")
    public StaffResponse createStaff(
            @AuthenticationPrincipal UserInfoDetails principal,
            @Valid @RequestBody StaffRequest request) {
        return adminService.createStaff(restaurantId(principal), principal.getUserInfo().getId(), request);
    }

    @PatchMapping("/staff/{userId}/active")
    public StaffResponse updateStaffStatus(
            @AuthenticationPrincipal UserInfoDetails principal,
            @PathVariable UUID userId,
            @Valid @RequestBody StaffStatusRequest request) {
        return adminService.updateStaffStatus(
                restaurantId(principal), principal.getUserInfo().getId(), userId, request);
    }

    @GetMapping("/roles")
    public List<RolePermissionsResponse> roles() {
        return adminService.roles();
    }

    private String restaurantId(UserInfoDetails principal) {
        return principal.getUserInfo().getRestaurantId();
    }
}
