package com.restaurent.business.auth.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import com.restaurent.business.auth.entities.Role;
import com.restaurent.business.auth.entities.Restaurant;
import com.restaurent.business.auth.entities.UserInfo;
import com.restaurent.business.auth.entities.dto.StaffRequest;
import com.restaurent.business.auth.entities.dto.StaffStatusRequest;
import com.restaurent.business.auth.repos.RestaurantRepository;
import com.restaurent.business.auth.repos.AuditLogRepository;
import com.restaurent.business.auth.repos.RoleRepository;
import com.restaurent.business.auth.repos.UserDetailsRepository;

class RestaurantAdminServiceTest {

    private RestaurantRepository restaurantRepository;
    private UserDetailsRepository userRepository;
    private RoleRepository roleRepository;
    private PasswordEncoder passwordEncoder;
    private AuthorizationVersionService versionService;
    private AuditLogRepository auditLogRepository;
    private RestaurantAdminService service;

    @BeforeEach
    void setUp() {
        restaurantRepository = org.mockito.Mockito.mock(RestaurantRepository.class);
        userRepository = org.mockito.Mockito.mock(UserDetailsRepository.class);
        roleRepository = org.mockito.Mockito.mock(RoleRepository.class);
        passwordEncoder = org.mockito.Mockito.mock(PasswordEncoder.class);
        versionService = org.mockito.Mockito.mock(AuthorizationVersionService.class);
        auditLogRepository = org.mockito.Mockito.mock(AuditLogRepository.class);
        Restaurant restaurant = new Restaurant();
        restaurant.setId(UUID.randomUUID());
        restaurant.setRestaurantId("restaurant-a");
        restaurant.setName("Restaurant A");
        restaurant.setStatus("ACTIVE");
        when(restaurantRepository.findByRestaurantId("restaurant-a")).thenReturn(Optional.of(restaurant));
        service = new RestaurantAdminService(
                restaurantRepository, auditLogRepository,
                userRepository, roleRepository, passwordEncoder, versionService);
    }

    @Test
    void staffCreationDerivesTenantAndRestrictsRoleToStaffCatalogue() {
        Role waiterRole = Role.builder().id(4).name("WAITER").privileges(Set.of()).build();
        when(userRepository.existsByEmailIgnoreCase("waiter@example.com")).thenReturn(false);
        when(roleRepository.findByName("WAITER")).thenReturn(Optional.of(waiterRole));
        when(passwordEncoder.encode("correct-horse-battery")).thenReturn("hashed");
        when(userRepository.saveAndFlush(any(UserInfo.class))).thenAnswer(invocation -> {
            UserInfo user = invocation.getArgument(0);
            user.setId(UUID.randomUUID());
            return user;
        });

        var saved = service.createStaff("restaurant-a", UUID.randomUUID(),
                new StaffRequest("Pat", "Waiter@Example.com", "correct-horse-battery", "WAITER"));

        assertEquals("waiter@example.com", saved.email());
        assertEquals("WAITER", saved.role());
        verify(userRepository).saveAndFlush(org.mockito.ArgumentMatchers.argThat(user ->
                "restaurant-a".equals(user.getRestaurantId())
                        && "hashed".equals(user.getPassword())
                        && "waiter@example.com".equals(user.getEmail())));
        verify(auditLogRepository).save(org.mockito.ArgumentMatchers.argThat(log ->
                "STAFF_CREATED".equals(log.getAction())
                        && "WAITER".equals(log.getDetails().get("role"))));
    }

    @Test
    void staffCannotBeUpdatedAcrossRestaurantBoundaries() {
        UUID userId = UUID.randomUUID();
        when(userRepository.findById(userId)).thenReturn(Optional.of(UserInfo.builder()
                .id(userId).restaurantId("restaurant-b")
                .role(Role.builder().name("WAITER").build()).isActive(true).build()));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.updateStaffStatus("restaurant-a", UUID.randomUUID(), userId,
                        new StaffStatusRequest(false)));

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        verify(userRepository, never()).saveAndFlush(any(UserInfo.class));
    }

    @Test
    void staffCreationCannotAssignRestaurantAdminRole() {
        StaffRequest request = new StaffRequest("Pat", "pat@example.com", "correct-horse-battery", "RESTAURANT_ADMIN");
        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.createStaff("restaurant-a", UUID.randomUUID(), request));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        verify(roleRepository, never()).findByName("RESTAURANT_ADMIN");
    }
}
