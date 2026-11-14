package com.restaurent.business.auth.entities.dto;

import java.util.UUID;

import com.restaurent.business.auth.entities.UserInfo;

public record StaffResponse(UUID id, String name, String email, String role, boolean active) {

    public static StaffResponse from(UserInfo user) {
        return new StaffResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole() == null ? null : user.getRole().getName(),
                user.isActive());
    }
}
