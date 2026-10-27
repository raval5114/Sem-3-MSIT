package com.restaurent.business.auth.controllers;

import com.restaurent.business.auth.entities.AuthRequest;
import com.restaurent.business.auth.entities.UserInfo;
import com.restaurent.business.auth.entities.dto.LoginSuccessResponse;
import com.restaurent.business.auth.entities.dto.UserRequest;
import com.restaurent.business.auth.services.JwtService;
import com.restaurent.business.auth.services.UserInfoDetails;
import com.restaurent.business.auth.services.UserInfoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/auth")
public class AuthController {

    @Autowired
    private UserInfoService service;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private AuthenticationManager authenticationManager;

    @GetMapping("/welcome")
    public String welcome() {
        return "Hello";
    }

    @PostMapping("/addNewUser")
    public String addNewUser(@RequestBody UserRequest userRequest) {
        return service.addUser(userRequest);
    }

    @PostMapping("/login")
    public LoginSuccessResponse authenticateAndGetToken(@RequestBody AuthRequest authRequest) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(authRequest.getEmail(), authRequest.getPassword())
        );

        if (authentication.isAuthenticated()) {
            UserInfoDetails userDetails = (UserInfoDetails) authentication.getPrincipal();
            UserInfo userInfo = userDetails.getUserInfo();

            Map<String, Object> extraClaims = new HashMap<>();
            extraClaims.put("email", userInfo.getEmail());
            extraClaims.put("restaurantId", userInfo.getRestaurantId());
            extraClaims.put("type", "STAFF");

            List<String> rolesList = new ArrayList<>();
            List<String> privilegesList = new ArrayList<>();

            if (userInfo.getRole() != null) {
                rolesList.add(userInfo.getRole().getName());
                if (userInfo.getRole().getPrivileges() != null) {
                    userInfo.getRole().getPrivileges().forEach(p -> privilegesList.add(p.getName()));
                }
            }
            extraClaims.put("roles", rolesList);
            extraClaims.put("privileges", privilegesList);

            // Format ID as per spec e.g. "u_<uuid>"
            String token = jwtService.generateToken("u_" + userInfo.getId().toString(), extraClaims);

            // Create dummy refresh token for now as per JSON format requirement
            String refreshToken = UUID.randomUUID().toString();

            return LoginSuccessResponse.builder()
                    .message("Login successful")
                    .token(token)
                    .refreshToken(refreshToken)
                    .expiresIn(900) // 15 minutes TTL as per spec
                    .tokenType("Bearer")
                    .build();
        } else {
            throw new UsernameNotFoundException("Invalid user request !");
        }
    }

    @PostMapping("/generateToken")
    public LoginSuccessResponse generateToken(@RequestBody AuthRequest authRequest) {
        return authenticateAndGetToken(authRequest);
    }

    @GetMapping("/user/userProfile")
    public String userProfile() {
        return "Welcome to User Profile";
    }

    @GetMapping("/admin/adminProfile")
    public String adminProfile() {
        return "Welcome to Admin Profile";
    }
}
