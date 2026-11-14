package com.restaurent.business.auth.entities.dto;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import com.restaurent.business.auth.entities.AuditLog;

public record AuditLogResponse(
        UUID id,
        UUID restaurantId,
        UUID actorId,
        String action,
        String resourceType,
        String resourceId,
        String outcome,
        String reason,
        Map<String, Object> details,
        Instant createdAt) {

    public static AuditLogResponse from(AuditLog log) {
        return new AuditLogResponse(
                log.getId(),
                log.getRestaurantId(),
                log.getActorId(),
                log.getAction(),
                log.getResourceType(),
                log.getResourceId(),
                log.getOutcome(),
                log.getReason(),
                log.getDetails(),
                log.getCreatedAt());
    }
}
