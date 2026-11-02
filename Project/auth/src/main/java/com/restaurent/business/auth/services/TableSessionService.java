package com.restaurent.business.auth.services;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.restaurent.business.auth.entities.RestaurantTable;
import com.restaurent.business.auth.entities.TableSession;
import com.restaurent.business.auth.entities.TableSessionStatus;
import com.restaurent.business.auth.entities.TableStatus;
import com.restaurent.business.auth.entities.dto.InitTableSessionRequest;
import com.restaurent.business.auth.entities.dto.TableSessionResponse;
import com.restaurent.business.auth.repos.RestaurantTableRepository;
import com.restaurent.business.auth.repos.TableSessionRepository;

@Service
public class TableSessionService {

    private static final Duration SESSION_LIFETIME = Duration.ofHours(2);
    private static final List<String> CUSTOMER_ROLES = List.of("CUSTOMER_GUEST");
    private static final List<String> CUSTOMER_PRIVILEGES = List.of("MENU_READ", "ORDER_CREATE", "PAYMENT_PROCESS");

    private final RestaurantTableRepository tableRepository;
    private final TableSessionRepository sessionRepository;
    private final QrCredentialService credentialService;
    private final TableSessionStateStore sessionStateStore;
    private final JwtService jwtService;

    public TableSessionService(RestaurantTableRepository tableRepository,
                              TableSessionRepository sessionRepository,
                              QrCredentialService credentialService,
                              TableSessionStateStore sessionStateStore,
                              JwtService jwtService) {
        this.tableRepository = tableRepository;
        this.sessionRepository = sessionRepository;
        this.credentialService = credentialService;
        this.sessionStateStore = sessionStateStore;
        this.jwtService = jwtService;
    }

    @Transactional
    public TableSessionResponse initialize(InitTableSessionRequest request) {
        String credentialHash = credentialService.hashToken(request.qrToken());
        RestaurantTable scannedTable = tableRepository.findByQrCredentialHash(credentialHash)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or revoked table QR"));

        if (!scannedTable.getId().equals(request.tableId())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "QR credential does not match this table");
        }

        RestaurantTable table = tableRepository.findByIdAndRestaurantIdForUpdate(
                        scannedTable.getId(), scannedTable.getRestaurantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid table QR"));

        if (!credentialHash.equals(table.getQrCredentialHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "QR credential was rotated");
        }
        if (table.getStatus() != TableStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.GONE, "This table is not accepting orders");
        }

        Instant now = Instant.now();
        TableSession session = sessionRepository
                .findFirstByTableIdAndStatusOrderByStartedAtDesc(table.getId(), TableSessionStatus.ACTIVE)
                .orElse(null);
        if (session != null && !session.getExpiresAt().isAfter(now)) {
            session.setStatus(TableSessionStatus.EXPIRED);
            session.setClosedAt(now);
            sessionRepository.save(session);
            session = null;
        }

        if (session == null) {
            session = new TableSession();
            session.setRestaurantId(table.getRestaurantId());
            session.setTableId(table.getId());
            session.setTableNumber(table.getTableNumber());
            session.setStatus(TableSessionStatus.ACTIVE);
            session.setStartedAt(now);
            session.setExpiresAt(now.plus(SESSION_LIFETIME));
            session = sessionRepository.saveAndFlush(session);
        }

        sessionStateStore.markActive(table.getRestaurantId(), table.getId(), session.getId(), session.getExpiresAt());
        return customerToken(table, session, now);
    }

    @Transactional
    public TableSessionResponse close(String restaurantId, UUID sessionId) {
        TableSession session = sessionRepository
                .findByIdAndRestaurantIdAndStatus(sessionId, restaurantId, TableSessionStatus.ACTIVE)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Active table session not found"));

        tableRepository.findByIdAndRestaurantIdForUpdate(session.getTableId(), restaurantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Table not found"));

        Instant now = Instant.now();
        session.setStatus(session.getExpiresAt().isAfter(now) ? TableSessionStatus.CLOSED : TableSessionStatus.EXPIRED);
        session.setClosedAt(now);
        sessionRepository.saveAndFlush(session);
        sessionStateStore.close(restaurantId, session.getTableId(), session.getId());

        return new TableSessionResponse(null, null, session.getRestaurantId(), session.getTableId(),
                session.getTableNumber(), session.getId(), session.getExpiresAt(), 0);
    }

    private TableSessionResponse customerToken(RestaurantTable table, TableSession session, Instant now) {
        Duration remaining = Duration.between(now, session.getExpiresAt());
        if (remaining.isNegative() || remaining.isZero()) {
            throw new ResponseStatusException(HttpStatus.GONE, "Table session expired; scan the QR again");
        }

        String guestId = "guest_" + UUID.randomUUID();
        Map<String, Object> claims = Map.of(
                "restaurantId", table.getRestaurantId(),
                "tableId", table.getId().toString(),
                "tableNumber", table.getTableNumber(),
                "tableSessionId", session.getId().toString(),
                "type", "CUSTOMER",
                "roles", CUSTOMER_ROLES,
                "privileges", CUSTOMER_PRIVILEGES);
        String token = jwtService.generateTableSessionToken(guestId, claims, remaining);

        return new TableSessionResponse(token, "Bearer", table.getRestaurantId(), table.getId(),
                table.getTableNumber(), session.getId(), session.getExpiresAt(), remaining.toSeconds());
    }
}
