package com.restaurent.business.auth.entities.dto;

import jakarta.validation.constraints.NotNull;

public record StaffStatusRequest(@NotNull Boolean active) {
}
