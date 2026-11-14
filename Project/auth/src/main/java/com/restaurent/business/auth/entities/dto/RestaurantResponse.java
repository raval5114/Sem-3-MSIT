package com.restaurent.business.auth.entities.dto;

import java.time.Instant;
import java.util.UUID;

import com.restaurent.business.auth.entities.Restaurant;

public record RestaurantResponse(
        UUID id,
        String restaurantId,
        String name,
        String status,
        Instant createdAt,
        Instant updatedAt) {

    public static RestaurantResponse from(Restaurant restaurant) {
        return new RestaurantResponse(
                restaurant.getId(),
                restaurant.getRestaurantId(),
                restaurant.getName(),
                restaurant.getStatus(),
                restaurant.getCreatedAt(),
                restaurant.getUpdatedAt());
    }
}
