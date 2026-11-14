package com.restaurent.business.auth.entities.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record SubscriptionPlanResponse(
        UUID id,
        String planKey,
        String name,
        String description,
        boolean active,
        boolean customPlan,
        List<PlanFeature> features,
        Instant createdAt,
        Instant updatedAt) {

    public record PlanFeature(String featureKey, boolean enabled, Map<String, Object> limits) {
    }
}
