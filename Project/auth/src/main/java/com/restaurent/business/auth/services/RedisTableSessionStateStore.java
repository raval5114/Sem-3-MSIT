package com.restaurent.business.auth.services;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class RedisTableSessionStateStore implements TableSessionStateStore {

    private final StringRedisTemplate redis;

    public RedisTableSessionStateStore(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @Override
    public void markActive(String restaurantId, UUID tableId, UUID sessionId, Instant expiresAt) {
        Duration ttl = Duration.between(Instant.now(), expiresAt);
        if (ttl.isNegative() || ttl.isZero()) {
            throw new IllegalArgumentException("Cannot cache an expired table session");
        }
        redis.opsForValue().set(activeTableKey(restaurantId, tableId), sessionId.toString(), ttl);
        redis.opsForValue().set(sessionKey(sessionId), "ACTIVE", ttl);
    }

    @Override
    public void close(String restaurantId, UUID tableId, UUID sessionId) {
        redis.delete(sessionKey(sessionId));
        String activeKey = activeTableKey(restaurantId, tableId);
        String currentSessionId = redis.opsForValue().get(activeKey);
        if (sessionId.toString().equals(currentSessionId)) {
            redis.delete(activeKey);
        }
    }

    private String activeTableKey(String restaurantId, UUID tableId) {
        return "dineflow:restaurant:" + restaurantId + ":table:" + tableId + ":active-session";
    }

    private String sessionKey(UUID sessionId) {
        return "dineflow:table-session:" + sessionId;
    }
}
