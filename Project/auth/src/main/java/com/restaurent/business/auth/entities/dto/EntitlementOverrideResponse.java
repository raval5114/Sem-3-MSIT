package com.restaurent.business.auth.entities.dto;

import java.time.Instant;
import java.util.UUID;

import com.restaurent.business.auth.entities.EntitlementOverride;

public record EntitlementOverrideResponse(
        UUID id,
        UUID restaurantId,
        String featureKey,
        boolean enabled,
        String reason,
        Instant validFrom,
        Instant validUntil,
        UUID createdBy,
        UUID updatedBy,
        Instant revokedAt,
        Instant createdAt,
        Instant updatedAt) {

    public static EntitlementOverrideResponse from(EntitlementOverride override) {
        return new EntitlementOverrideResponse(override.getId(), override.getRestaurantId(),
                override.getFeatureKey(), override.isEnabled(), override.getReason(),
                override.getValidFrom(), override.getValidUntil(), override.getCreatedBy(),
                override.getUpdatedBy(), override.getRevokedAt(), override.getCreatedAt(),
                override.getUpdatedAt());
    }
}
