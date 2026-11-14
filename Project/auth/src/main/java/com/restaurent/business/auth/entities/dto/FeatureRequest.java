package com.restaurent.business.auth.entities.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record FeatureRequest(
        @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{2,100}") String featureKey,
        @NotBlank @Size(max = 150) String name,
        @NotBlank @Size(max = 4000) String description,
        @NotBlank @Size(max = 80) String category,
        boolean active,
        boolean limitsSupported) {
}
