package com.restaurent.business.auth.entities.dto;

import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record InitTableSessionRequest(
        @NotNull UUID tableId,
        @NotBlank @Size(max = 128) String qrToken) {
}
