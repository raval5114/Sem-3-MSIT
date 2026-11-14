package com.restaurent.business.auth.entities.dto;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record AccessContextResponse(
        UUID userId,
        String displayName,
        String email,
        String role,
        String restaurantId,
        String restaurantName,
        String subscriptionStatus,
        Map<String, Long> authorizationVersions,
        Map<String, FeatureAccess> features,
        List<String> permissions,
        List<NavigationItem> navigation) {

    public record FeatureAccess(boolean enabled, Map<String, Object> limits, String source) {}

    public record NavigationItem(String featureKey, String label, String path) {}
}
