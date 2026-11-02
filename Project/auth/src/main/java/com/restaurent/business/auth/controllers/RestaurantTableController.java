package com.restaurent.business.auth.controllers;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import com.restaurent.business.auth.entities.TableStatus;
import com.restaurent.business.auth.entities.dto.CreateTableRequest;
import com.restaurent.business.auth.entities.dto.QrCodeResponse;
import com.restaurent.business.auth.entities.dto.TableResponse;
import com.restaurent.business.auth.entities.dto.UpdateTableRequest;
import com.restaurent.business.auth.entities.dto.UpdateTableStatusRequest;
import com.restaurent.business.auth.services.RestaurantTableService;
import com.restaurent.business.auth.services.TableQrService;
import com.restaurent.business.auth.services.UserInfoDetails;

@RestController
@RequestMapping("/auth/tables")
@PreAuthorize("hasAuthority('TABLE_MANAGE')")
public class RestaurantTableController {

    private final RestaurantTableService tableService;
    private final TableQrService tableQrService;

    public RestaurantTableController(RestaurantTableService tableService, TableQrService tableQrService) {
        this.tableService = tableService;
        this.tableQrService = tableQrService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TableResponse create(@AuthenticationPrincipal UserInfoDetails staff,
                                @Valid @RequestBody CreateTableRequest request) {
        return tableService.create(staff.getUserInfo().getRestaurantId(), staffId(staff), request);
    }

    @GetMapping
    public List<TableResponse> list(@AuthenticationPrincipal UserInfoDetails staff) {
        return tableService.list(staff.getUserInfo().getRestaurantId());
    }

    @GetMapping("/{tableId}")
    public TableResponse get(@AuthenticationPrincipal UserInfoDetails staff,
                             @PathVariable UUID tableId) {
        return tableService.get(staff.getUserInfo().getRestaurantId(), tableId);
    }

    @PutMapping("/{tableId}")
    public TableResponse update(@AuthenticationPrincipal UserInfoDetails staff,
                                @PathVariable UUID tableId,
                                @Valid @RequestBody UpdateTableRequest request) {
        return tableService.update(staff.getUserInfo().getRestaurantId(), staffId(staff), tableId, request);
    }

    @PatchMapping("/{tableId}/status")
    public TableResponse updateStatus(@AuthenticationPrincipal UserInfoDetails staff,
                                      @PathVariable UUID tableId,
                                      @Valid @RequestBody UpdateTableStatusRequest request) {
        return tableService.updateStatus(staff.getUserInfo().getRestaurantId(), staffId(staff), tableId,
                request.status());
    }

    @PostMapping("/{tableId}/qr/rotate")
    public QrCodeResponse issueQr(@AuthenticationPrincipal UserInfoDetails staff,
                                  @PathVariable UUID tableId) {
        return tableQrService.issueOrRotate(staff.getUserInfo().getRestaurantId(), staffId(staff), tableId);
    }

    private UUID staffId(UserInfoDetails staff) {
        return staff.getUserInfo().getId();
    }
}
