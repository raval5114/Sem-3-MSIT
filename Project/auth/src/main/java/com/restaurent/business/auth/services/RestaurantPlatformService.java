package com.restaurent.business.auth.services;

import java.time.Instant;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.restaurent.business.auth.entities.AuditLog;
import com.restaurent.business.auth.entities.Restaurant;
import com.restaurent.business.auth.entities.RestaurantRegistration;
import com.restaurent.business.auth.entities.dto.AuditLogResponse;
import com.restaurent.business.auth.entities.dto.RegistrationDecisionRequest;
import com.restaurent.business.auth.entities.dto.RestaurantRegistrationRequest;
import com.restaurent.business.auth.entities.dto.RestaurantRegistrationResponse;
import com.restaurent.business.auth.entities.dto.RestaurantResponse;
import com.restaurent.business.auth.repos.AuditLogRepository;
import com.restaurent.business.auth.repos.RestaurantRegistrationRepository;
import com.restaurent.business.auth.repos.RestaurantRepository;

@Service
public class RestaurantPlatformService {

    private static final String PENDING = "PENDING";
    private final RestaurantRegistrationRepository registrationRepository;
    private final RestaurantRepository restaurantRepository;
    private final AuditLogRepository auditLogRepository;
    private final AuthorizationVersionService authorizationVersionService;

    public RestaurantPlatformService(
            RestaurantRegistrationRepository registrationRepository,
            RestaurantRepository restaurantRepository,
            AuditLogRepository auditLogRepository,
            AuthorizationVersionService authorizationVersionService) {
        this.registrationRepository = registrationRepository;
        this.restaurantRepository = restaurantRepository;
        this.auditLogRepository = auditLogRepository;
        this.authorizationVersionService = authorizationVersionService;
    }

    @Transactional
    public RestaurantRegistrationResponse submitRegistration(RestaurantRegistrationRequest request) {
        String restaurantName = normalize(request.restaurantName());
        String ownerName = normalize(request.ownerName());
        String ownerEmail = normalize(request.ownerEmail()).toLowerCase(Locale.ROOT);
        if (registrationRepository.existsPendingDuplicate(ownerEmail, restaurantName)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "A pending registration already exists for this owner email or restaurant name");
        }

        RestaurantRegistration registration = new RestaurantRegistration();
        registration.setRestaurantName(restaurantName);
        registration.setOwnerName(ownerName);
        registration.setOwnerEmail(ownerEmail);
        registration.setPhone(clean(request.phone()));
        registration.setAddress(clean(request.address()));
        registration.setStatus(PENDING);
        try {
            return RestaurantRegistrationResponse.from(
                    registrationRepository.saveAndFlush(registration), null);
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "A pending registration already exists for this owner email or restaurant name", exception);
        }
    }

    @Transactional(readOnly = true)
    public Page<RestaurantRegistrationResponse> listRegistrations(
            String status, String query, Pageable pageable) {
        return registrationRepository.search(normalizeStatus(status), searchQuery(query), pageable)
                .map(registration -> RestaurantRegistrationResponse.from(
                        registration, approvedRestaurantId(registration)));
    }

    @Transactional(readOnly = true)
    public Page<RestaurantResponse> listRestaurants(String status, String query, Pageable pageable) {
        return restaurantRepository.search(normalizeStatus(status), searchQuery(query), pageable)
                .map(RestaurantResponse::from);
    }

    @Transactional(readOnly = true)
    public Page<AuditLogResponse> listAuditLogs(UUID restaurantId, String resourceType, Pageable pageable) {
        return auditLogRepository.search(restaurantId, clean(resourceType), pageable)
                .map(AuditLogResponse::from);
    }

    @Transactional
    public RestaurantRegistrationResponse approve(UUID registrationId, UUID actorId) {
        RestaurantRegistration registration = pendingRegistration(registrationId);
        Restaurant restaurant = new Restaurant();
        restaurant.setRestaurantId(generateRestaurantId());
        restaurant.setName(registration.getRestaurantName());
        restaurant.setContactPhone(registration.getPhone());
        restaurant.setAddress(registration.getAddress());
        restaurant.setStatus("ACTIVE");
        try {
            restaurant = restaurantRepository.saveAndFlush(restaurant);
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Could not allocate a unique restaurant ID; retry the approval", exception);
        }

        registration.setStatus("APPROVED");
        registration.setApprovedRestaurantId(restaurant.getId());
        registration.setReviewedBy(actorId);
        registration.setReviewedAt(Instant.now());
        registration.setRejectionReason(null);
        registration = saveReview(registration);
        authorizationVersionService.invalidate("RESTAURANT", restaurant.getRestaurantId());
        writeAudit(actorId, restaurant.getId(), "RESTAURANT_REGISTRATION_APPROVED",
                "RESTAURANT_REGISTRATION", registration.getId().toString(), null,
                Map.of("restaurantId", restaurant.getRestaurantId()));
        return RestaurantRegistrationResponse.from(registration, restaurant.getRestaurantId());
    }

    @Transactional
    public RestaurantRegistrationResponse reject(
            UUID registrationId, UUID actorId, RegistrationDecisionRequest decision) {
        RestaurantRegistration registration = pendingRegistration(registrationId);
        registration.setStatus("REJECTED");
        registration.setReviewedBy(actorId);
        registration.setReviewedAt(Instant.now());
        registration.setRejectionReason(normalize(decision.reason()));
        registration = saveReview(registration);
        writeAudit(actorId, null, "RESTAURANT_REGISTRATION_REJECTED",
                "RESTAURANT_REGISTRATION", registration.getId().toString(),
                registration.getRejectionReason(), Map.of());
        return RestaurantRegistrationResponse.from(registration, null);
    }

    @Transactional
    public RestaurantResponse suspend(String restaurantId, UUID actorId, RegistrationDecisionRequest decision) {
        Restaurant restaurant = restaurant(restaurantId);
        if (!"ACTIVE".equals(restaurant.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Only an active restaurant can be suspended");
        }
        restaurant.setStatus("SUSPENDED");
        restaurant = saveRestaurantStatus(restaurant);
        authorizationVersionService.invalidate("RESTAURANT", restaurant.getRestaurantId());
        writeAudit(actorId, restaurant.getId(), "RESTAURANT_SUSPENDED",
                "RESTAURANT", restaurant.getRestaurantId(), normalize(decision.reason()), Map.of());
        return RestaurantResponse.from(restaurant);
    }

    @Transactional
    public RestaurantResponse reactivate(String restaurantId, UUID actorId) {
        Restaurant restaurant = restaurant(restaurantId);
        if (!"SUSPENDED".equals(restaurant.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Only a suspended restaurant can be reactivated");
        }
        restaurant.setStatus("ACTIVE");
        restaurant = saveRestaurantStatus(restaurant);
        authorizationVersionService.invalidate("RESTAURANT", restaurant.getRestaurantId());
        writeAudit(actorId, restaurant.getId(), "RESTAURANT_REACTIVATED",
                "RESTAURANT", restaurant.getRestaurantId(), null, Map.of());
        return RestaurantResponse.from(restaurant);
    }

    private RestaurantRegistration pendingRegistration(UUID id) {
        RestaurantRegistration registration = registrationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Restaurant registration not found"));
        if (!PENDING.equals(registration.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Only pending registrations can be reviewed");
        }
        return registration;
    }

    private RestaurantRegistration saveReview(RestaurantRegistration registration) {
        try {
            return registrationRepository.saveAndFlush(registration);
        } catch (ObjectOptimisticLockingFailureException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This registration was reviewed by another administrator", exception);
        }
    }

    private Restaurant saveRestaurantStatus(Restaurant restaurant) {
        try {
            return restaurantRepository.saveAndFlush(restaurant);
        } catch (ObjectOptimisticLockingFailureException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Restaurant status changed during this operation; refresh and retry", exception);
        }
    }

    private Restaurant restaurant(String restaurantId) {
        return restaurantRepository.findByRestaurantId(restaurantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Restaurant not found"));
    }

    private String approvedRestaurantId(RestaurantRegistration registration) {
        if (registration.getApprovedRestaurantId() == null) return null;
        return restaurantRepository.findById(registration.getApprovedRestaurantId())
                .map(Restaurant::getRestaurantId)
                .orElse(null);
    }

    private void writeAudit(
            UUID actorId, UUID restaurantId, String action, String resourceType,
            String resourceId, String reason, Map<String, Object> details) {
        AuditLog log = new AuditLog();
        log.setActorId(actorId);
        log.setRestaurantId(restaurantId);
        log.setAction(action);
        log.setResourceType(resourceType);
        log.setResourceId(resourceId);
        log.setOutcome("SUCCESS");
        log.setReason(reason);
        log.setDetails(new HashMap<>(details));
        auditLogRepository.save(log);
    }

    private String generateRestaurantId() {
        return "DF-" + UUID.randomUUID().toString().replace("-", "").toUpperCase(Locale.ROOT);
    }

    private String normalizeStatus(String status) {
        String cleaned = clean(status);
        if (cleaned == null) return "";
        String normalized = cleaned.toUpperCase(Locale.ROOT);
        if (!java.util.Set.of("PENDING", "APPROVED", "REJECTED", "ACTIVE", "SUSPENDED", "INACTIVE")
                .contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported status filter");
        }
        return normalized;
    }

    private String normalize(String value) {
        return value.trim().replaceAll("\\s+", " ");
    }

    private String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String searchQuery(String value) {
        String cleaned = clean(value);
        return cleaned == null ? "" : cleaned;
    }
}
