package com.restaurent.business.auth.entities.dto;

import java.time.Instant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record TransitionSubscriptionRequest(
        @NotBlank @Pattern(regexp = "TRIALING|ACTIVE|PAST_DUE|CANCELLED|SUSPENDED|EXPIRED") String status,
        @NotBlank @Size(max = 2000) String reason,
        Instant currentPeriodEnd) {
}
