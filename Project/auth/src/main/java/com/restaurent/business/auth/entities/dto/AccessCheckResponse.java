package com.restaurent.business.auth.entities.dto;

public record AccessCheckResponse(
        boolean allowed,
        String code,
        String message,
        AccessContextResponse context) {}
