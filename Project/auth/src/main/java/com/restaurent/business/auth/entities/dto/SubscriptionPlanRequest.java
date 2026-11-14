package com.restaurent.business.auth.entities.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SubscriptionPlanRequest(
        @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{2,80}") String planKey,
        @NotBlank @Size(max = 120) String name,
        @Size(max = 4000) String description,
        boolean active,
        boolean customPlan,
        @NotNull List<@Valid PlanFeatureRequest> features) {
}
