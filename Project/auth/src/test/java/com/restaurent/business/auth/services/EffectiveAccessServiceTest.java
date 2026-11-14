package com.restaurent.business.auth.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.restaurent.business.auth.entities.Feature;
import com.restaurent.business.auth.entities.EntitlementOverride;
import com.restaurent.business.auth.entities.Privilege;
import com.restaurent.business.auth.entities.Restaurant;
import com.restaurent.business.auth.entities.RestaurantSubscription;
import com.restaurent.business.auth.entities.Role;
import com.restaurent.business.auth.entities.UserInfo;
import com.restaurent.business.auth.entities.dto.AccessCheckRequest;
import com.restaurent.business.auth.repos.EntitlementOverrideRepository;
import com.restaurent.business.auth.repos.FeatureRepository;
import com.restaurent.business.auth.repos.RestaurantRepository;
import com.restaurent.business.auth.repos.RestaurantSubscriptionRepository;

@ExtendWith(MockitoExtension.class)
class EffectiveAccessServiceTest {

    private static final String RESTAURANT_ID = "DF-ACCESS";
    private static final UUID RESTAURANT_DB_ID = UUID.randomUUID();

    @Mock private RestaurantRepository restaurantRepository;
    @Mock private RestaurantSubscriptionRepository subscriptionRepository;
    @Mock private FeatureRepository featureRepository;
    @Mock private EntitlementOverrideRepository overrideRepository;
    @Mock private AuthorizationVersionService versionService;

    private EffectiveAccessService accessService;
    private UserInfoDetails principal;
    private Restaurant restaurant;
    private RestaurantSubscription subscription;
    private Feature feature;

    @BeforeEach
    void setUp() {
        accessService = new EffectiveAccessService(
                restaurantRepository, subscriptionRepository, featureRepository,
                overrideRepository, versionService);

        Privilege orderRead = new Privilege();
        orderRead.setName("ORDER_READ_ACTIVE");
        Role role = Role.builder().id(1).name("RESTAURANT_ADMIN").privileges(Set.of(orderRead)).build();
        UserInfo user = UserInfo.builder()
                .id(UUID.randomUUID())
                .email("staff@example.test")
                .password("encoded")
                .role(role)
                .restaurantId(RESTAURANT_ID)
                .isActive(true)
                .build();
        principal = new UserInfoDetails(user, true);

        restaurant = new Restaurant();
        restaurant.setId(RESTAURANT_DB_ID);
        restaurant.setRestaurantId(RESTAURANT_ID);
        restaurant.setName("Access Bistro");
        restaurant.setStatus("ACTIVE");
        when(restaurantRepository.findByRestaurantId(RESTAURANT_ID)).thenReturn(java.util.Optional.of(restaurant));

        feature = new Feature();
        feature.setFeatureKey("ORDER_MANAGEMENT");
        feature.setName("Order management");
        feature.setActive(true);
        when(featureRepository.findAll()).thenReturn(List.of(feature));
        when(versionService.versions(user.getId(), RESTAURANT_ID, 1)).thenReturn(Map.of());

        subscription = new RestaurantSubscription();
        subscription.setRestaurantId(RESTAURANT_DB_ID);
        subscription.setStatus("ACTIVE");
        subscription.setStartsAt(Instant.now().minus(1, ChronoUnit.DAYS));
        subscription.setCurrentPeriodEnd(Instant.now().plus(1, ChronoUnit.DAYS));
        subscription.setEntitlementsSnapshot(Map.of(
                "ORDER_MANAGEMENT", Map.of("enabled", true, "limits", Map.of("maxOrders", 100))));
        when(subscriptionRepository.findAllByRestaurantIdOrderByCreatedAtDesc(RESTAURANT_DB_ID))
                .thenReturn(List.of(subscription));
    }

    @Test
    void requiresBothFeatureEntitlementAndRolePermission() {
        var entitled = accessService.authorize(principal,
                new AccessCheckRequest("ORDER_MANAGEMENT", "ORDER_READ_ACTIVE", RESTAURANT_ID));
        assertTrue(entitled.allowed());

        var roleDenied = accessService.authorize(principal,
                new AccessCheckRequest("ORDER_MANAGEMENT", "ORDER_UPDATE_STATUS", RESTAURANT_ID));
        assertFalse(roleDenied.allowed());
        assertEquals("PERMISSION_DENIED", roleDenied.code());

        subscription.setEntitlementsSnapshot(Map.of());
        var featureDenied = accessService.authorize(principal,
                new AccessCheckRequest("ORDER_MANAGEMENT", "ORDER_READ_ACTIVE", RESTAURANT_ID));
        assertFalse(featureDenied.allowed());
        assertEquals("FEATURE_DISABLED", featureDenied.code());
    }

    @Test
    void deniesCrossTenantAndExpiredSubscriptionRequests() {
        var crossTenant = accessService.authorize(principal,
                new AccessCheckRequest("ORDER_MANAGEMENT", "ORDER_READ_ACTIVE", "DF-OTHER"));
        assertFalse(crossTenant.allowed());
        assertEquals("CROSS_TENANT_FORBIDDEN", crossTenant.code());

        subscription.setCurrentPeriodEnd(Instant.now().minus(1, ChronoUnit.SECONDS));
        var expired = accessService.authorize(principal,
                new AccessCheckRequest("ORDER_MANAGEMENT", "ORDER_READ_ACTIVE", RESTAURANT_ID));
        assertFalse(expired.allowed());
        assertEquals("SUBSCRIPTION_INACTIVE", expired.code());
    }

    @Test
    void deniesInactiveUsersRestaurantsAndSuspendedSubscriptions() {
        principal.getUserInfo().setActive(false);
        var inactiveUser = accessService.authorize(principal,
                new AccessCheckRequest("ORDER_MANAGEMENT", "ORDER_READ_ACTIVE", RESTAURANT_ID));
        assertEquals("USER_INACTIVE", inactiveUser.code());

        principal.getUserInfo().setActive(true);
        restaurant.setStatus("SUSPENDED");
        var inactiveRestaurant = accessService.authorize(principal,
                new AccessCheckRequest("ORDER_MANAGEMENT", "ORDER_READ_ACTIVE", RESTAURANT_ID));
        assertEquals("RESTAURANT_INACTIVE", inactiveRestaurant.code());
        var inactiveContext = accessService.context(principal);
        assertFalse(inactiveContext.features().get("ORDER_MANAGEMENT").enabled());
        assertTrue(inactiveContext.navigation().isEmpty());

        restaurant.setStatus("ACTIVE");
        subscription.setStatus("SUSPENDED");
        var suspendedSubscription = accessService.authorize(principal,
                new AccessCheckRequest("ORDER_MANAGEMENT", "ORDER_READ_ACTIVE", RESTAURANT_ID));
        assertEquals("SUBSCRIPTION_INACTIVE", suspendedSubscription.code());
    }

    @Test
    void permitsOnlyTheConfiguredPastDueGraceAndCancellationWindows() {
        subscription.setStatus("PAST_DUE");
        subscription.setGracePeriodEndsAt(Instant.now().plus(1, ChronoUnit.DAYS));
        assertTrue(accessService.authorize(principal,
                new AccessCheckRequest("ORDER_MANAGEMENT", "ORDER_READ_ACTIVE", RESTAURANT_ID)).allowed());

        subscription.setGracePeriodEndsAt(Instant.now().minus(1, ChronoUnit.SECONDS));
        assertEquals("SUBSCRIPTION_INACTIVE", accessService.authorize(principal,
                new AccessCheckRequest("ORDER_MANAGEMENT", "ORDER_READ_ACTIVE", RESTAURANT_ID)).code());

        subscription.setStatus("CANCELLED");
        subscription.setCurrentPeriodEnd(Instant.now().plus(1, ChronoUnit.DAYS));
        assertTrue(accessService.authorize(principal,
                new AccessCheckRequest("ORDER_MANAGEMENT", "ORDER_READ_ACTIVE", RESTAURANT_ID)).allowed());
    }

    @Test
    void validOverrideEnablesFeatureExcludedFromPlan() {
        subscription.setEntitlementsSnapshot(Map.of());
        EntitlementOverride override = new EntitlementOverride();
        override.setEnabled(true);
        when(overrideRepository.findCurrentlyValid(
                org.mockito.ArgumentMatchers.eq(RESTAURANT_DB_ID),
                org.mockito.ArgumentMatchers.eq("ORDER_MANAGEMENT"),
                org.mockito.ArgumentMatchers.any(Instant.class)))
                .thenReturn(List.of(override));
        var result = accessService.authorize(principal,
                new AccessCheckRequest("ORDER_MANAGEMENT", "ORDER_READ_ACTIVE", RESTAURANT_ID));
        assertTrue(result.allowed());
        assertEquals("OVERRIDE", result.context().features().get("ORDER_MANAGEMENT").source());
    }
}
