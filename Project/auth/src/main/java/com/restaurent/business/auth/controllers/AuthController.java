package com.restaurent.business.auth.controllers;
import com.restaurent.business.auth.entities.AuthRequest;
import com.restaurent.business.auth.entities.UserInfo;
import com.restaurent.business.auth.entities.dto.LoginSuccessResponse;
import com.restaurent.business.auth.entities.dto.UserRequest;
import com.restaurent.business.auth.services.JwtService;
import com.restaurent.business.auth.services.UserInfoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.bind.annotation.*;
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
        UserInfo userInfo = UserInfo.builder()
                .name(userRequest.getName())
                .email(userRequest.getEmail())
                .password(userRequest.getPassword())
                .roles(userRequest.getRoles())
                .build();
        return service.addUser(userInfo);
    }
    @PostMapping("/login")
    public LoginSuccessResponse authenticateAndGetToken(@RequestBody AuthRequest authRequest) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(authRequest.getEmail(), authRequest.getPassword())
        );
        if (authentication.isAuthenticated()) {
            String token = jwtService.generateToken(authRequest.getEmail());
            return LoginSuccessResponse.builder()
                    .message("Login successful")
                    .token(token)
                    .tokenType("Bearer")
                    .build();
        } else {
            throw new UsernameNotFoundException("Invalid user request !");
        }
    }
    
    @PostMapping("/generateToken")
    public LoginSuccessResponse generateToken(@RequestBody AuthRequest authRequest) {
        return authenticateAndGetToken(authRequest); // Alias mapping based on API_DOCS.md / ARCHITECTURE.md
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
