package com.restaurent.business.auth.entities.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RestaurantRegistrationRequest(
        @NotBlank @Size(max = 200) String restaurantName,
        @NotBlank @Size(max = 200) String ownerName,
        @NotBlank @Email @Size(max = 320) String ownerEmail,
        @Size(max = 50) String phone,
        @Size(max = 10000) String address) {
}
