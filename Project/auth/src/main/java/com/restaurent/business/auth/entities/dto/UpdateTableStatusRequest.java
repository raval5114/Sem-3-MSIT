package com.restaurent.business.auth.entities.dto;

import com.restaurent.business.auth.entities.TableStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateTableStatusRequest(@NotNull TableStatus status) {
}
