package com.restaurent.business.auth.entities.dto;

import java.util.Map;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record PlanFeatureRequest(
        @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{2,100}") String featureKey,
        boolean enabled,
        Map<String, Object> limits) {
}
