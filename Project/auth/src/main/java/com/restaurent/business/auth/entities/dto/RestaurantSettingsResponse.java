package com.restaurent.business.auth.entities.dto;

import com.restaurent.business.auth.entities.Restaurant;

public record RestaurantSettingsResponse(
        String restaurantId,
        String name,
        String contactPhone,
        String address) {

    public static RestaurantSettingsResponse from(Restaurant restaurant) {
        return new RestaurantSettingsResponse(
                restaurant.getRestaurantId(),
                restaurant.getName(),
                restaurant.getContactPhone(),
                restaurant.getAddress());
    }
}
