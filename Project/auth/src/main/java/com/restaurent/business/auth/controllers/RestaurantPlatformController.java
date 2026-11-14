package com.restaurent.business.auth.controllers;

import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.restaurent.business.auth.entities.dto.AuditLogResponse;
import com.restaurent.business.auth.entities.dto.RegistrationDecisionRequest;
import com.restaurent.business.auth.entities.dto.RestaurantRegistrationResponse;
import com.restaurent.business.auth.entities.dto.RestaurantResponse;
import com.restaurent.business.auth.services.RestaurantPlatformService;
import com.restaurent.business.auth.services.UserInfoDetails;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

@RestController
@RequestMapping("/auth/platform")
@PreAuthorize("hasAuthority('SUPER_ADMIN')")
public class RestaurantPlatformController {

    private final RestaurantPlatformService platformService;

    public RestaurantPlatformController(RestaurantPlatformService platformService) {
        this.platformService = platformService;
    }

    @GetMapping("/registrations")
    public Page<RestaurantRegistrationResponse> registrations(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return platformService.listRegistrations(status, query, pageRequest(page, size));
    }

    @PostMapping("/registrations/{registrationId}/approve")
    @ResponseStatus(HttpStatus.OK)
    public RestaurantRegistrationResponse approve(
            @PathVariable UUID registrationId,
            @AuthenticationPrincipal UserInfoDetails staff) {
        return platformService.approve(registrationId, staff.getUserInfo().getId());
    }

    @PostMapping("/registrations/{registrationId}/reject")
    public RestaurantRegistrationResponse reject(
            @PathVariable UUID registrationId,
            @AuthenticationPrincipal UserInfoDetails staff,
            @Valid @RequestBody RegistrationDecisionRequest decision) {
        return platformService.reject(registrationId, staff.getUserInfo().getId(), decision);
    }

    @GetMapping("/restaurants")
    public Page<RestaurantResponse> restaurants(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return platformService.listRestaurants(status, query, pageRequest(page, size));
    }

    @PostMapping("/restaurants/{restaurantId}/suspend")
    public RestaurantResponse suspend(
            @PathVariable String restaurantId,
            @AuthenticationPrincipal UserInfoDetails staff,
            @Valid @RequestBody RegistrationDecisionRequest decision) {
        return platformService.suspend(restaurantId, staff.getUserInfo().getId(), decision);
    }

    @PostMapping("/restaurants/{restaurantId}/reactivate")
    public RestaurantResponse reactivate(
            @PathVariable String restaurantId,
            @AuthenticationPrincipal UserInfoDetails staff) {
        return platformService.reactivate(restaurantId, staff.getUserInfo().getId());
    }

    @GetMapping("/audit-logs")
    public Page<AuditLogResponse> auditLogs(
            @RequestParam(required = false) UUID restaurantId,
            @RequestParam(required = false) String resourceType,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return platformService.listAuditLogs(restaurantId, resourceType, pageRequest(page, size));
    }

    private Pageable pageRequest(int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Page must be non-negative and size must be between 1 and 100");
        }
        return PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
    }
}
