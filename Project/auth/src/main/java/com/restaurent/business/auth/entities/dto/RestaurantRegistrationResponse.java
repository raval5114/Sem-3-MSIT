package com.restaurent.business.auth.entities.dto;

import java.time.Instant;
import java.util.UUID;

import com.restaurent.business.auth.entities.RestaurantRegistration;

public record RestaurantRegistrationResponse(
        UUID id,
        String restaurantName,
        String ownerName,
        String ownerEmail,
        String phone,
        String address,
        String status,
        String restaurantId,
        UUID reviewedBy,
        Instant reviewedAt,
        String rejectionReason,
        Instant createdAt) {

    public static RestaurantRegistrationResponse from(RestaurantRegistration registration, String restaurantId) {
        return new RestaurantRegistrationResponse(
                registration.getId(),
                registration.getRestaurantName(),
                registration.getOwnerName(),
                registration.getOwnerEmail(),
                registration.getPhone(),
                registration.getAddress(),
                registration.getStatus(),
                restaurantId,
                registration.getReviewedBy(),
                registration.getReviewedAt(),
                registration.getRejectionReason(),
                registration.getCreatedAt());
    }
}
