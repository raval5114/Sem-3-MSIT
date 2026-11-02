package com.restaurent.business.auth.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.restaurent.business.auth.entities.RestaurantTable;
import com.restaurent.business.auth.entities.dto.QrCodeResponse;
import com.restaurent.business.auth.repos.RestaurantTableRepository;

class TableQrServiceTest {

    private RestaurantTableRepository repository;
    private QrCredentialService credentialService;
    private TableQrService service;
    private RestaurantTable table;

    @BeforeEach
    void setUp() {
        repository = mock(RestaurantTableRepository.class);
        credentialService = new QrCredentialService();
        QrCodeImageService imageService = new QrCodeImageService();
        table = new RestaurantTable();
        table.setId(UUID.randomUUID());
        table.setRestaurantId("restaurant-a");
        table.setTableNumber(7);
        table.setSeatingCapacity(4);
        table.setQrCredentialVersion(0);
        when(repository.findByIdAndRestaurantIdForUpdate(table.getId(), "restaurant-a"))
                .thenReturn(java.util.Optional.of(table));
        when(repository.saveAndFlush(any(RestaurantTable.class))).thenAnswer(invocation -> invocation.getArgument(0));
        service = new TableQrService(repository, credentialService, imageService, "https://dineflow.test");
    }

    @Test
    void issuesOpaqueQrCredentialAndRenderablePng() throws Exception {
        UUID staffId = UUID.randomUUID();

        QrCodeResponse response = service.issueOrRotate("restaurant-a", staffId, table.getId());
        String rawToken = queryToken(response.customerUrl());

        assertEquals(table.getId(), response.tableId());
        assertEquals(1, response.credentialVersion());
        assertEquals("https://dineflow.test/r/restaurant-a/t/" + table.getId(),
                response.customerUrl().split("\\?")[0]);
        assertNotEquals(rawToken, table.getQrCredentialHash());
        assertEquals(credentialService.hashToken(rawToken), table.getQrCredentialHash());
        assertTrue(response.qrCodeDataUri().startsWith("data:image/png;base64,"));
        byte[] png = java.util.Base64.getDecoder().decode(response.qrCodeDataUri().substring("data:image/png;base64,".length()));
        assertTrue(png.length > 100);
        assertEquals(staffId, table.getUpdatedBy());
    }

    @Test
    void rotatingQrReplacesItsStoredCredentialAndIncrementsVersion() {
        QrCodeResponse first = service.issueOrRotate("restaurant-a", UUID.randomUUID(), table.getId());
        String firstToken = queryToken(first.customerUrl());
        QrCodeResponse second = service.issueOrRotate("restaurant-a", UUID.randomUUID(), table.getId());
        String secondToken = queryToken(second.customerUrl());

        assertEquals(2, second.credentialVersion());
        assertNotEquals(firstToken, secondToken);
        assertNotEquals(credentialService.hashToken(firstToken), table.getQrCredentialHash());
        assertEquals(credentialService.hashToken(secondToken), table.getQrCredentialHash());
    }

    private String queryToken(String url) {
        return java.util.Arrays.stream(URI.create(url).getRawQuery().split("&"))
                .filter(part -> part.startsWith("token="))
                .map(part -> part.substring("token=".length()))
                .findFirst().orElseThrow();
    }
}
