package com.restaurent.business.auth.controllers;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import com.restaurent.business.auth.entities.dto.InitTableSessionRequest;
import com.restaurent.business.auth.entities.dto.TableSessionResponse;
import com.restaurent.business.auth.services.TableSessionService;
import com.restaurent.business.auth.services.UserInfoDetails;

@RestController
@RequestMapping("/auth/table-session")
public class TableSessionController {

    private final TableSessionService tableSessionService;

    public TableSessionController(TableSessionService tableSessionService) {
        this.tableSessionService = tableSessionService;
    }

    @PostMapping("/init")
    @ResponseStatus(HttpStatus.CREATED)
    public TableSessionResponse initialize(@Valid @RequestBody InitTableSessionRequest request) {
        return tableSessionService.initialize(request);
    }

    @PostMapping("/{sessionId}/close")
    @PreAuthorize("hasAuthority('TABLE_MANAGE')")
    public TableSessionResponse close(@AuthenticationPrincipal UserInfoDetails staff,
                                      @PathVariable UUID sessionId) {
        return tableSessionService.close(staff.getUserInfo().getRestaurantId(), sessionId);
    }
}
