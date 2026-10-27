package com.restaurent.business.auth.entities.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class LoginSuccessResponse {

    private String message;
    private String token;
    private String refreshToken;
    private long expiresIn;

    @Builder.Default
    private String tokenType = "Bearer";
}
