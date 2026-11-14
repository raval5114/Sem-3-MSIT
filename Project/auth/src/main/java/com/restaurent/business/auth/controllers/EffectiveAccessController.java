package com.restaurent.business.auth.controllers;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.restaurent.business.auth.entities.dto.AccessCheckRequest;
import com.restaurent.business.auth.entities.dto.AccessCheckResponse;
import com.restaurent.business.auth.entities.dto.AccessContextResponse;
import com.restaurent.business.auth.entities.dto.AccessContextResponse.FeatureAccess;
import com.restaurent.business.auth.entities.dto.AccessContextResponse.NavigationItem;
import com.restaurent.business.auth.services.EffectiveAccessService;
import com.restaurent.business.auth.services.UserInfoDetails;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/auth/access")
public class EffectiveAccessController {

    private final EffectiveAccessService accessService;

    public EffectiveAccessController(EffectiveAccessService accessService) {
        this.accessService = accessService;
    }

    @GetMapping("/context")
    public AccessContextResponse context(@AuthenticationPrincipal UserInfoDetails principal) {
        return accessService.context(principal);
    }

    @GetMapping("/features")
    public Map<String, FeatureAccess> features(@AuthenticationPrincipal UserInfoDetails principal) {
        return accessService.context(principal).features();
    }

    @GetMapping("/navigation")
    public List<NavigationItem> navigation(@AuthenticationPrincipal UserInfoDetails principal) {
        return accessService.context(principal).navigation();
    }

    @PostMapping("/authorize")
    public ResponseEntity<AccessCheckResponse> authorize(
            @AuthenticationPrincipal UserInfoDetails principal,
            @Valid @RequestBody AccessCheckRequest request) {
        AccessCheckResponse response = accessService.authorize(principal, request);
        return ResponseEntity.status(response.allowed() ? HttpStatus.OK : HttpStatus.FORBIDDEN)
                .body(response);
    }
}
