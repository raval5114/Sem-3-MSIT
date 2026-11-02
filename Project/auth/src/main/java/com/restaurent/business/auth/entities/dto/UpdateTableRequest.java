package com.restaurent.business.auth.entities.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record UpdateTableRequest(
        @NotNull @Positive Integer tableNumber,
        @NotNull @Positive Integer seatingCapacity,
        @Size(max = 80) String section,
        @Size(max = 100) String displayName) {
}
