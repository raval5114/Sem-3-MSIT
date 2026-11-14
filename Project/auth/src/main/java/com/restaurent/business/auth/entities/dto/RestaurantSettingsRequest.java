package com.restaurent.business.auth.entities.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RestaurantSettingsRequest(
        @NotBlank @Size(max = 200) String name,
        @Size(max = 32) String contactPhone,
        @Size(max = 2000) String address) {
}
