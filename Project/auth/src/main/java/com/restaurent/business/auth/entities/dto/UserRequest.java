package com.restaurent.business.auth.entities.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class UserRequest {

    @NotBlank @Size(max = 200)
    private String name;
    @NotBlank @Email @Size(max = 320)
    private String email;
    @NotBlank @Size(min = 12, max = 72)
    private String password;
    @NotBlank @Pattern(regexp = "RESTAURANT_ADMIN|WAITER|CHEF|CASHIER")
    private String roleName;
    @NotBlank @Size(max = 100)
    private String restaurantId;
}
