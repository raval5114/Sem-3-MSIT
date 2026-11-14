package com.restaurent.business.auth.entities.dto;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record SubscriptionResponse(
        UUID id,
        String restaurantId,
        UUID planId,
        String planKey,
        String planName,
        String status,
        String billingPeriod,
        Instant startsAt,
        Instant currentPeriodStart,
        Instant currentPeriodEnd,
        Instant trialStartsAt,
        Instant trialEndsAt,
        Instant gracePeriodEndsAt,
        Instant cancelledAt,
        Instant endedAt,
        Map<String, Object> entitlementsSnapshot,
        Instant createdAt,
        Instant updatedAt) {
}
