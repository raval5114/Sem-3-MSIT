package com.restaurent.business.auth.entities.dto;

import jakarta.validation.constraints.NotBlank;

public record AccessCheckRequest(
        @NotBlank String featureKey,
        @NotBlank String permission,
        String restaurantId) {}
