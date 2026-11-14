package com.restaurent.business.auth.controllers;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.restaurent.business.auth.entities.dto.RestaurantRegistrationRequest;
import com.restaurent.business.auth.entities.dto.RestaurantRegistrationResponse;
import com.restaurent.business.auth.services.RestaurantPlatformService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/auth/restaurant-registrations")
public class RestaurantRegistrationController {

    private final RestaurantPlatformService platformService;

    public RestaurantRegistrationController(RestaurantPlatformService platformService) {
        this.platformService = platformService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RestaurantRegistrationResponse submit(@Valid @RequestBody RestaurantRegistrationRequest request) {
        return platformService.submitRegistration(request);
    }
}
