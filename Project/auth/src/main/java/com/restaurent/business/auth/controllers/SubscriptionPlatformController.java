package com.restaurent.business.auth.controllers;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.restaurent.business.auth.entities.dto.AssignSubscriptionRequest;
import com.restaurent.business.auth.entities.dto.EntitlementOverrideRequest;
import com.restaurent.business.auth.entities.dto.EntitlementOverrideResponse;
import com.restaurent.business.auth.entities.dto.FeatureRequest;
import com.restaurent.business.auth.entities.dto.FeatureResponse;
import com.restaurent.business.auth.entities.dto.RegistrationDecisionRequest;
import com.restaurent.business.auth.entities.dto.SubscriptionPlanRequest;
import com.restaurent.business.auth.entities.dto.SubscriptionPlanResponse;
import com.restaurent.business.auth.entities.dto.SubscriptionResponse;
import com.restaurent.business.auth.entities.dto.TransitionSubscriptionRequest;
import com.restaurent.business.auth.services.SubscriptionPlatformService;
import com.restaurent.business.auth.services.UserInfoDetails;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/auth/platform")
@PreAuthorize("hasAuthority('SUPER_ADMIN')")
public class SubscriptionPlatformController {

    private final SubscriptionPlatformService subscriptionService;

    public SubscriptionPlatformController(SubscriptionPlatformService subscriptionService) {
        this.subscriptionService = subscriptionService;
    }

    @GetMapping("/features")
    public List<FeatureResponse> features() {
        return subscriptionService.listFeatures();
    }

    @PostMapping("/features")
    @ResponseStatus(HttpStatus.CREATED)
    public FeatureResponse createFeature(
            @Valid @RequestBody FeatureRequest request,
            @AuthenticationPrincipal UserInfoDetails staff) {
        return subscriptionService.createFeature(request, staff.getUserInfo().getId());
    }

    @PutMapping("/features/{featureKey}")
    public FeatureResponse updateFeature(
            @PathVariable String featureKey,
            @Valid @RequestBody FeatureRequest request,
            @AuthenticationPrincipal UserInfoDetails staff) {
        return subscriptionService.updateFeature(featureKey, request, staff.getUserInfo().getId());
    }

    @GetMapping("/plans")
    public List<SubscriptionPlanResponse> plans() {
        return subscriptionService.listPlans();
    }

    @PostMapping("/plans")
    @ResponseStatus(HttpStatus.CREATED)
    public SubscriptionPlanResponse createPlan(
            @Valid @RequestBody SubscriptionPlanRequest request,
            @AuthenticationPrincipal UserInfoDetails staff) {
        return subscriptionService.createPlan(request, staff.getUserInfo().getId());
    }

    @PutMapping("/plans/{planId}")
    public SubscriptionPlanResponse updatePlan(
            @PathVariable UUID planId,
            @Valid @RequestBody SubscriptionPlanRequest request,
            @AuthenticationPrincipal UserInfoDetails staff) {
        return subscriptionService.updatePlan(planId, request, staff.getUserInfo().getId());
    }

    @GetMapping("/restaurants/{restaurantId}/subscriptions")
    public List<SubscriptionResponse> subscriptions(@PathVariable String restaurantId) {
        return subscriptionService.listSubscriptions(restaurantId);
    }

    @PostMapping("/restaurants/{restaurantId}/subscriptions")
    @ResponseStatus(HttpStatus.CREATED)
    public SubscriptionResponse assignSubscription(
            @PathVariable String restaurantId,
            @Valid @RequestBody AssignSubscriptionRequest request,
            @AuthenticationPrincipal UserInfoDetails staff) {
        return subscriptionService.assignSubscription(restaurantId, request, staff.getUserInfo().getId());
    }

    @PutMapping("/subscriptions/{subscriptionId}/status")
    public SubscriptionResponse transitionSubscription(
            @PathVariable UUID subscriptionId,
            @Valid @RequestBody TransitionSubscriptionRequest request,
            @AuthenticationPrincipal UserInfoDetails staff) {
        return subscriptionService.transitionSubscription(
                subscriptionId, request, staff.getUserInfo().getId());
    }

    @GetMapping("/restaurants/{restaurantId}/overrides")
    public List<EntitlementOverrideResponse> overrides(@PathVariable String restaurantId) {
        return subscriptionService.listOverrides(restaurantId);
    }

    @PostMapping("/restaurants/{restaurantId}/overrides")
    @ResponseStatus(HttpStatus.CREATED)
    public EntitlementOverrideResponse createOverride(
            @PathVariable String restaurantId,
            @Valid @RequestBody EntitlementOverrideRequest request,
            @AuthenticationPrincipal UserInfoDetails staff) {
        return subscriptionService.createOverride(restaurantId, request, staff.getUserInfo().getId());
    }

    @PutMapping("/overrides/{overrideId}")
    public EntitlementOverrideResponse updateOverride(
            @PathVariable UUID overrideId,
            @Valid @RequestBody EntitlementOverrideRequest request,
            @AuthenticationPrincipal UserInfoDetails staff) {
        return subscriptionService.updateOverride(overrideId, request, staff.getUserInfo().getId());
    }

    @PostMapping("/overrides/{overrideId}/revoke")
    public EntitlementOverrideResponse revokeOverride(
            @PathVariable UUID overrideId,
            @Valid @RequestBody RegistrationDecisionRequest decision,
            @AuthenticationPrincipal UserInfoDetails staff) {
        return subscriptionService.revokeOverride(overrideId, decision, staff.getUserInfo().getId());
    }
}
