package com.restaurent.business.auth.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.restaurent.business.auth.config.KeyConfig;
import com.restaurent.business.auth.entities.RestaurantTable;
import com.restaurent.business.auth.entities.TableSession;
import com.restaurent.business.auth.entities.TableSessionStatus;
import com.restaurent.business.auth.entities.TableStatus;
import com.restaurent.business.auth.entities.dto.InitTableSessionRequest;
import com.restaurent.business.auth.repos.RestaurantTableRepository;
import com.restaurent.business.auth.repos.TableSessionRepository;

class TableSessionServiceTest {

    @TempDir
    Path keyDirectory;

    private RestaurantTableRepository tableRepository;
    private TableSessionRepository sessionRepository;
    private QrCredentialService credentialService;
    private TableSessionStateStore stateStore;
    private JwtService jwtService;
    private TableSessionService service;
    private RestaurantTable table;
    private String token;

    @BeforeEach
    void setUp() {
        tableRepository = mock(RestaurantTableRepository.class);
        sessionRepository = mock(TableSessionRepository.class);
        stateStore = mock(TableSessionStateStore.class);
        credentialService = new QrCredentialService();
        jwtService = new JwtService(new KeyConfig(keyDirectory.toString()).rsaKey());
        service = new TableSessionService(tableRepository, sessionRepository, credentialService, stateStore, jwtService);

        token = credentialService.generateToken();
        table = new RestaurantTable();
        table.setId(UUID.randomUUID());
        table.setRestaurantId("restaurant-a");
        table.setTableNumber(7);
        table.setSeatingCapacity(4);
        table.setStatus(TableStatus.ACTIVE);
        table.setQrCredentialHash(credentialService.hashToken(token));
        when(tableRepository.findByQrCredentialHash(table.getQrCredentialHash())).thenReturn(Optional.of(table));
        when(tableRepository.findByIdAndRestaurantIdForUpdate(table.getId(), "restaurant-a"))
                .thenReturn(Optional.of(table));
        when(sessionRepository.findFirstByTableIdAndStatusOrderByStartedAtDesc(table.getId(), TableSessionStatus.ACTIVE))
                .thenReturn(Optional.empty());
        when(sessionRepository.saveAndFlush(any(TableSession.class))).thenAnswer(invocation -> {
            TableSession session = invocation.getArgument(0);
            if (session.getId() == null) session.setId(UUID.randomUUID());
            return session;
        });
    }

    @Test
    void validQrCreatesSessionAndIssuesScopedCustomerJwt() {
        var response = service.initialize(new InitTableSessionRequest(table.getId(), token));

        assertEquals("restaurant-a", response.restaurantId());
        assertEquals(table.getId(), response.tableId());
        assertEquals(7, response.tableNumber());
        assertEquals("Bearer", response.tokenType());
        assertEquals(7200, response.expiresInSeconds());
        assertEquals("CUSTOMER", jwtService.extractClaim(response.accessToken(), claims -> claims.get("type", String.class)));
        assertEquals("restaurant-a", jwtService.extractClaim(response.accessToken(), claims -> claims.get("restaurantId", String.class)));
        assertEquals(response.tableSessionId().toString(), jwtService.extractClaim(response.accessToken(), claims -> claims.get("tableSessionId", String.class)));
        assertEquals(List.of("CUSTOMER_GUEST"), jwtService.extractClaim(response.accessToken(), claims -> claims.get("roles", List.class)));
        assertEquals(List.of("MENU_READ", "ORDER_CREATE", "PAYMENT_PROCESS"),
                jwtService.extractClaim(response.accessToken(), claims -> claims.get("privileges", List.class)));
        assertEquals("guest_", jwtService.extractUsername(response.accessToken()).substring(0, 6));
        verify(stateStore).markActive("restaurant-a", table.getId(), response.tableSessionId(), response.expiresAt());
    }

    @Test
    void repeatedScanReusesActiveSessionButIssuesFreshGuestToken() {
        TableSession active = activeSession();
        when(sessionRepository.findFirstByTableIdAndStatusOrderByStartedAtDesc(table.getId(), TableSessionStatus.ACTIVE))
                .thenReturn(Optional.of(active));
        when(sessionRepository.saveAndFlush(active)).thenReturn(active);

        var first = service.initialize(new InitTableSessionRequest(table.getId(), token));
        var second = service.initialize(new InitTableSessionRequest(table.getId(), token));

        assertEquals(active.getId(), first.tableSessionId());
        assertEquals(active.getId(), second.tableSessionId());
        assertNotEquals(jwtService.extractUsername(first.accessToken()), jwtService.extractUsername(second.accessToken()));
        assertEquals(active.getExpiresAt(), second.expiresAt());
        verify(sessionRepository, never()).saveAndFlush(any(TableSession.class));
    }

    @Test
    void invalidCredentialAndWrongTableAreRejected() {
        when(tableRepository.findByQrCredentialHash(credentialService.hashToken("invalid")))
                .thenReturn(Optional.empty());
        ResponseStatusException invalid = assertThrows(ResponseStatusException.class,
                () -> service.initialize(new InitTableSessionRequest(table.getId(), "invalid")));
        assertEquals(HttpStatus.UNAUTHORIZED, invalid.getStatusCode());

        UUID anotherTable = UUID.randomUUID();
        ResponseStatusException mismatch = assertThrows(ResponseStatusException.class,
                () -> service.initialize(new InitTableSessionRequest(anotherTable, token)));
        assertEquals(HttpStatus.UNAUTHORIZED, mismatch.getStatusCode());
    }

    @Test
    void inactiveTableDoesNotCreateASession() {
        table.setStatus(TableStatus.MAINTENANCE);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.initialize(new InitTableSessionRequest(table.getId(), token)));

        assertEquals(HttpStatus.GONE, exception.getStatusCode());
        verify(sessionRepository, never()).saveAndFlush(any(TableSession.class));
    }

    @Test
    void expiredActiveSessionIsMarkedExpiredAndReplaced() {
        TableSession expired = activeSession();
        expired.setExpiresAt(Instant.now().minusSeconds(60));
        when(sessionRepository.findFirstByTableIdAndStatusOrderByStartedAtDesc(table.getId(), TableSessionStatus.ACTIVE))
                .thenReturn(Optional.of(expired));

        var response = service.initialize(new InitTableSessionRequest(table.getId(), token));

        assertEquals(TableSessionStatus.EXPIRED, expired.getStatus());
        org.junit.jupiter.api.Assertions.assertNotNull(expired.getClosedAt());
        assertNotEquals(expired.getId(), response.tableSessionId());
        verify(sessionRepository).save(expired);
        verify(stateStore).markActive("restaurant-a", table.getId(), response.tableSessionId(), response.expiresAt());
    }

    private TableSession activeSession() {
        TableSession session = new TableSession();
        session.setId(UUID.randomUUID());
        session.setRestaurantId("restaurant-a");
        session.setTableId(table.getId());
        session.setTableNumber(table.getTableNumber());
        session.setStatus(TableSessionStatus.ACTIVE);
        session.setStartedAt(Instant.now().minusSeconds(30));
        session.setExpiresAt(Instant.now().plusSeconds(600));
        return session;
    }
}
