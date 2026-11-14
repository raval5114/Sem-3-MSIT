package com.restaurent.business.auth.entities.dto;

import java.time.Instant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record EntitlementOverrideRequest(
        @NotBlank @Size(max = 100) String featureKey,
        boolean enabled,
        @NotBlank @Size(max = 2000) String reason,
        Instant validFrom,
        Instant validUntil) {
}
