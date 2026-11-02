package com.restaurent.business.auth.entities.dto;

import java.time.Instant;
import java.util.UUID;

public record QrCodeResponse(
        UUID tableId,
        Integer tableNumber,
        String customerUrl,
        String qrCodeDataUri,
        Integer credentialVersion,
        Instant issuedAt) {
}
