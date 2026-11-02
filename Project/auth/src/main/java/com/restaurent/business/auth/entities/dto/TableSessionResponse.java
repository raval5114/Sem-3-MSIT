package com.restaurent.business.auth.entities.dto;

import java.time.Instant;
import java.util.UUID;

public record TableSessionResponse(
        String accessToken,
        String tokenType,
        String restaurantId,
        UUID tableId,
        Integer tableNumber,
        UUID tableSessionId,
        Instant expiresAt,
        long expiresInSeconds) {
}
