package com.restaurent.business.auth.entities.dto;

import java.util.List;

public record RolePermissionsResponse(String role, List<String> permissions) {
}
