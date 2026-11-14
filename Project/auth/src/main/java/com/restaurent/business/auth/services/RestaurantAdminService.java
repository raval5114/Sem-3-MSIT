package com.restaurent.business.auth.services;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.restaurent.business.auth.entities.Restaurant;
import com.restaurent.business.auth.entities.Role;
import com.restaurent.business.auth.entities.UserInfo;
import com.restaurent.business.auth.entities.AuditLog;
import com.restaurent.business.auth.entities.dto.RestaurantSettingsRequest;
import com.restaurent.business.auth.entities.dto.RestaurantSettingsResponse;
import com.restaurent.business.auth.entities.dto.RolePermissionsResponse;
import com.restaurent.business.auth.entities.dto.StaffRequest;
import com.restaurent.business.auth.entities.dto.StaffResponse;
import com.restaurent.business.auth.entities.dto.StaffStatusRequest;
import com.restaurent.business.auth.repos.RestaurantRepository;
import com.restaurent.business.auth.repos.AuditLogRepository;
import com.restaurent.business.auth.repos.RoleRepository;
import com.restaurent.business.auth.repos.UserDetailsRepository;

@Service
public class RestaurantAdminService {

    private static final Set<String> STAFF_ROLES = Set.of("WAITER", "CHEF", "CASHIER");

    private final RestaurantRepository restaurantRepository;
    private final AuditLogRepository auditLogRepository;
    private final UserDetailsRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthorizationVersionService authorizationVersionService;

    public RestaurantAdminService(
            RestaurantRepository restaurantRepository,
            AuditLogRepository auditLogRepository,
            UserDetailsRepository userRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder,
            AuthorizationVersionService authorizationVersionService) {
        this.restaurantRepository = restaurantRepository;
        this.auditLogRepository = auditLogRepository;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.authorizationVersionService = authorizationVersionService;
    }

    @Transactional(readOnly = true)
    public RestaurantSettingsResponse settings(String restaurantId) {
        return RestaurantSettingsResponse.from(findRestaurant(restaurantId));
    }

    @Transactional
    public RestaurantSettingsResponse updateSettings(String restaurantId, UUID actorId, RestaurantSettingsRequest request) {
        Restaurant restaurant = findRestaurant(restaurantId);
        restaurant.setName(request.name().trim());
        restaurant.setContactPhone(clean(request.contactPhone()));
        restaurant.setAddress(clean(request.address()));
        Restaurant saved = restaurantRepository.save(restaurant);
        writeAudit(actorId, saved, "RESTAURANT_SETTINGS_UPDATED", "RESTAURANT", restaurantId,
                Map.of("changedFields", List.of("name", "contactPhone", "address")));
        authorizationVersionService.invalidate("RESTAURANT", restaurantId);
        return RestaurantSettingsResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<StaffResponse> staff(String restaurantId) {
        requireRestaurantId(restaurantId);
        return userRepository.findAllByRestaurantIdOrderByNameAsc(restaurantId).stream()
                .filter(user -> isManagedStaff(user.getRole()))
                .map(StaffResponse::from)
                .toList();
    }

    @Transactional
    public StaffResponse createStaff(String restaurantId, UUID actorId, StaffRequest request) {
        requireRestaurantId(restaurantId);
        Restaurant restaurant = findRestaurant(restaurantId);
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with this email already exists");
        }

        String roleName = request.roleName().trim().toUpperCase(Locale.ROOT);
        if (!STAFF_ROLES.contains(roleName)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only Waiter, Chef, or Cashier accounts can be managed here");
        }
        Role role = roleRepository.findByName(roleName)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "The selected staff role is unavailable"));

        UserInfo user = UserInfo.builder()
                .name(request.name().trim())
                .email(email)
                .password(passwordEncoder.encode(request.password()))
                .role(role)
                .restaurantId(restaurantId)
                .isActive(true)
                .build();
        UserInfo saved = userRepository.saveAndFlush(user);
        writeAudit(actorId, restaurant, "STAFF_CREATED", "USER", saved.getId().toString(),
                Map.of("role", roleName));
        authorizationVersionService.invalidate("USER", saved.getId().toString());
        return StaffResponse.from(saved);
    }

    @Transactional
    public StaffResponse updateStaffStatus(String restaurantId, UUID actorId, UUID userId, StaffStatusRequest request) {
        requireRestaurantId(restaurantId);
        Restaurant restaurant = findRestaurant(restaurantId);
        if (actorId.equals(userId) && !request.active()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You cannot deactivate your own account");
        }
        UserInfo user = userRepository.findById(userId)
                .filter(candidate -> restaurantId.equals(candidate.getRestaurantId()))
                .filter(candidate -> isManagedStaff(candidate.getRole()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff account not found"));
        user.setActive(request.active());
        UserInfo saved = userRepository.saveAndFlush(user);
        writeAudit(actorId, restaurant, request.active() ? "STAFF_ACTIVATED" : "STAFF_DEACTIVATED",
                "USER", saved.getId().toString(), Map.of("active", request.active()));
        authorizationVersionService.invalidate("USER", saved.getId().toString());
        return StaffResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<RolePermissionsResponse> roles() {
        return STAFF_ROLES.stream().sorted()
                .map(name -> roleRepository.findByName(name)
                        .map(role -> new RolePermissionsResponse(
                                role.getName(),
                                role.getPrivileges().stream()
                                        .map(privilege -> privilege.getName())
                                        .sorted()
                                        .toList()))
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.CONFLICT, "The staff role catalogue is incomplete")))
                .toList();
    }

    private Restaurant findRestaurant(String restaurantId) {
        requireRestaurantId(restaurantId);
        return restaurantRepository.findByRestaurantId(restaurantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Restaurant not found"));
    }

    private void requireRestaurantId(String restaurantId) {
        if (restaurantId == null || restaurantId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Restaurant scope is required");
        }
    }

    private boolean isManagedStaff(Role role) {
        return role != null && STAFF_ROLES.contains(role.getName());
    }

    private String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private void writeAudit(UUID actorId, Restaurant restaurant, String action, String resourceType,
            String resourceId, Map<String, Object> details) {
        AuditLog log = new AuditLog();
        log.setActorId(actorId);
        log.setRestaurantId(restaurant.getId());
        log.setAction(action);
        log.setResourceType(resourceType);
        log.setResourceId(resourceId);
        log.setOutcome("SUCCESS");
        log.setDetails(details);
        auditLogRepository.save(log);
    }
}
