package com.restaurent.business.auth.services;

import java.time.Instant;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import com.restaurent.business.auth.entities.RestaurantTable;
import com.restaurent.business.auth.entities.dto.QrCodeResponse;
import com.restaurent.business.auth.repos.RestaurantTableRepository;

@Service
public class TableQrService {

    private final RestaurantTableRepository tableRepository;
    private final QrCredentialService credentialService;
    private final QrCodeImageService imageService;
    private final String customerBaseUrl;

    public TableQrService(RestaurantTableRepository tableRepository,
                          QrCredentialService credentialService,
                          QrCodeImageService imageService,
                          @Value("${dineflow.customer.base-url:http://localhost:3000}") String customerBaseUrl) {
        this.tableRepository = tableRepository;
        this.credentialService = credentialService;
        this.imageService = imageService;
        this.customerBaseUrl = customerBaseUrl;
    }

    @Transactional
    public QrCodeResponse issueOrRotate(String restaurantId, UUID staffId, UUID tableId) {
        RestaurantTable table = tableRepository.findByIdAndRestaurantIdForUpdate(tableId, restaurantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Table not found"));

        String rawToken = credentialService.generateToken();
        table.setQrCredentialHash(credentialService.hashToken(rawToken));
        table.setQrCredentialVersion(table.getQrCredentialVersion() == null ? 1 : table.getQrCredentialVersion() + 1);
        table.setQrIssuedAt(Instant.now());
        table.setUpdatedBy(staffId);
        table = tableRepository.saveAndFlush(table);

        String customerUrl = UriComponentsBuilder.fromUriString(customerBaseUrl)
                .pathSegment("r", table.getRestaurantId(), "t", table.getId().toString())
                .queryParam("token", rawToken)
                .build().encode().toUriString();

        return new QrCodeResponse(table.getId(), table.getTableNumber(), customerUrl,
                imageService.toPngDataUri(customerUrl), table.getQrCredentialVersion(), table.getQrIssuedAt());
    }
}
