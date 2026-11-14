package com.restaurent.business.auth.entities.dto;

import java.time.Instant;
import java.util.UUID;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AssignSubscriptionRequest(
        @NotNull UUID planId,
        @Pattern(regexp = "TRIALING|ACTIVE") String status,
        @Pattern(regexp = "MONTHLY|ANNUAL|CUSTOM") String billingPeriod,
        Instant startsAt,
        Instant currentPeriodStart,
        Instant currentPeriodEnd,
        Instant trialEndsAt,
        @Size(max = 2000) String reason) {
}
