package com.restaurent.business.auth.services;

import java.time.Instant;
import java.util.UUID;

public interface TableSessionStateStore {
    void markActive(String restaurantId, UUID tableId, UUID sessionId, Instant expiresAt);
    void close(String restaurantId, UUID tableId, UUID sessionId);
}
