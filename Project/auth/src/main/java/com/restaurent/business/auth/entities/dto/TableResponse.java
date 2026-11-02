package com.restaurent.business.auth.entities.dto;

import java.time.Instant;
import java.util.UUID;

import com.restaurent.business.auth.entities.RestaurantTable;
import com.restaurent.business.auth.entities.TableStatus;

public record TableResponse(
        UUID id,
        String restaurantId,
        Integer tableNumber,
        Integer seatingCapacity,
        String section,
        String displayName,
        TableStatus status,
        Instant createdAt,
        Instant updatedAt) {

    public static TableResponse from(RestaurantTable table) {
        return new TableResponse(
                table.getId(), table.getRestaurantId(), table.getTableNumber(),
                table.getSeatingCapacity(), table.getSection(), table.getDisplayName(),
                table.getStatus(), table.getCreatedAt(), table.getUpdatedAt());
    }
}
