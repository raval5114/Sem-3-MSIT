package com.restaurent.business.auth.entities.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegistrationDecisionRequest(
        @NotBlank @Size(max = 2000) String reason) {
}
