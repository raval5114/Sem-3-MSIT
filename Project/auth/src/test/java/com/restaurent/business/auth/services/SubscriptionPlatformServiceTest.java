package com.restaurent.business.auth.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.restaurent.business.auth.entities.EntitlementOverride;
import com.restaurent.business.auth.entities.Feature;
import com.restaurent.business.auth.entities.PlanFeature;
import com.restaurent.business.auth.entities.Restaurant;
import com.restaurent.business.auth.entities.RestaurantSubscription;
import com.restaurent.business.auth.entities.SubscriptionPlan;
import com.restaurent.business.auth.entities.dto.AssignSubscriptionRequest;
import com.restaurent.business.auth.entities.dto.EntitlementOverrideRequest;
import com.restaurent.business.auth.entities.dto.FeatureRequest;
import com.restaurent.business.auth.entities.dto.PlanFeatureRequest;
import com.restaurent.business.auth.entities.dto.RegistrationDecisionRequest;
import com.restaurent.business.auth.entities.dto.SubscriptionPlanRequest;
import com.restaurent.business.auth.entities.dto.TransitionSubscriptionRequest;
import com.restaurent.business.auth.repos.AuditLogRepository;
import com.restaurent.business.auth.repos.EntitlementOverrideRepository;
import com.restaurent.business.auth.repos.FeatureRepository;
import com.restaurent.business.auth.repos.PlanFeatureRepository;
import com.restaurent.business.auth.repos.RestaurantRepository;
import com.restaurent.business.auth.repos.RestaurantSubscriptionRepository;
import com.restaurent.business.auth.repos.SubscriptionEventRepository;
import com.restaurent.business.auth.repos.SubscriptionPlanRepository;

@ExtendWith(MockitoExtension.class)
class SubscriptionPlatformServiceTest {

    @Mock private FeatureRepository featureRepository;
    @Mock private SubscriptionPlanRepository planRepository;
    @Mock private PlanFeatureRepository planFeatureRepository;
    @Mock private RestaurantRepository restaurantRepository;
    @Mock private RestaurantSubscriptionRepository subscriptionRepository;
    @Mock private SubscriptionEventRepository eventRepository;
    @Mock private EntitlementOverrideRepository overrideRepository;
    @Mock private AuditLogRepository auditLogRepository;
    @Mock private AuthorizationVersionService authorizationVersionService;

    @InjectMocks
    private SubscriptionPlatformService subscriptionService;

    @Test
    void planEditsDoNotChangeExistingSubscriptionSnapshotAndLifecycleIsAudited() {
        UUID actorId = UUID.randomUUID();
        UUID planId = UUID.randomUUID();
        UUID restaurantDbId = UUID.randomUUID();
        Feature feature = feature("STAFF_LIMIT", true);
        PlanFeature mapping = planFeature(planId, feature.getFeatureKey(), true, Map.of("maxStaff", 12));
        SubscriptionPlan plan = plan(planId, "LAUNCH");
        Restaurant restaurant = restaurant(restaurantDbId, "DF-SNAPSHOT", "Snapshot Bistro");
        when(featureRepository.findById("STAFF_LIMIT")).thenReturn(Optional.of(feature));
        when(planRepository.findByPlanKey("LAUNCH")).thenReturn(Optional.empty());
        when(planRepository.saveAndFlush(any(SubscriptionPlan.class))).thenAnswer(call -> {
            SubscriptionPlan saved = call.getArgument(0);
            saved.setId(planId);
            saved.setCreatedAt(Instant.now());
            saved.setUpdatedAt(Instant.now());
            return saved;
        });
        when(planRepository.findById(planId)).thenReturn(Optional.of(plan));
        when(planFeatureRepository.findAllByPlanId(planId)).thenReturn(List.of(mapping));
        when(restaurantRepository.findByRestaurantId("DF-SNAPSHOT")).thenReturn(Optional.of(restaurant));
        when(restaurantRepository.findById(restaurantDbId)).thenReturn(Optional.of(restaurant));
        AtomicReference<RestaurantSubscription> savedSubscription = new AtomicReference<>();
        when(subscriptionRepository.saveAndFlush(any(RestaurantSubscription.class))).thenAnswer(call -> {
            RestaurantSubscription saved = call.getArgument(0);
            saved.setId(UUID.randomUUID());
            saved.setCreatedAt(Instant.now());
            saved.setUpdatedAt(Instant.now());
            savedSubscription.set(saved);
            return saved;
        });

        var createdPlan = subscriptionService.createPlan(new SubscriptionPlanRequest(
                "launch", "Launch", "Test plan", true, false,
                List.of(new PlanFeatureRequest("staff_limit", true, Map.of("maxStaff", 12)))), actorId);
        assertEquals(planId, createdPlan.id());
        Instant periodStart = Instant.now();
        var assigned = subscriptionService.assignSubscription("DF-SNAPSHOT",
                new AssignSubscriptionRequest(planId, "ACTIVE", "MONTHLY", null,
                        periodStart, periodStart.plus(30, ChronoUnit.DAYS), null, "Initial subscription"), actorId);
        assertEquals("ACTIVE", assigned.status());
        assertTrue(assigned.entitlementsSnapshot().containsKey("STAFF_LIMIT"));

        subscriptionService.updatePlan(planId, new SubscriptionPlanRequest(
                "LAUNCH", "Launch revised", "Updated mapping", true, false, List.of()), actorId);
        assertTrue(assigned.entitlementsSnapshot().containsKey("STAFF_LIMIT"));

        when(subscriptionRepository.findById(assigned.id())).thenAnswer(call -> Optional.of(savedSubscription.get()));
        var pastDue = subscriptionService.transitionSubscription(assigned.id(),
                new TransitionSubscriptionRequest("PAST_DUE", "Payment failed", null), actorId);
        assertNotNull(pastDue.gracePeriodEndsAt());
        assertTrue(pastDue.gracePeriodEndsAt().isAfter(Instant.now()));
        var active = subscriptionService.transitionSubscription(assigned.id(),
                new TransitionSubscriptionRequest("ACTIVE", "Payment recovered", null), actorId);
        assertEquals("ACTIVE", active.status());
        assertNotNull(active.currentPeriodEnd());
        ResponseStatusException invalid = assertThrows(ResponseStatusException.class,
                () -> subscriptionService.transitionSubscription(assigned.id(),
                        new TransitionSubscriptionRequest("TRIALING", "Invalid reverse transition", null),
                        actorId));
        assertEquals(HttpStatus.CONFLICT, invalid.getStatusCode());
        verify(eventRepository, org.mockito.Mockito.times(3)).save(any());
    }

    @Test
    void trialExpiryIsIdempotentAndStatusTransitionsRejectInvalidMoves() {
        UUID subscriptionId = UUID.randomUUID();
        UUID restaurantId = UUID.randomUUID();
        RestaurantSubscription subscription = new RestaurantSubscription();
        subscription.setId(subscriptionId);
        subscription.setRestaurantId(restaurantId);
        subscription.setStatus("TRIALING");
        subscription.setTrialEndsAt(Instant.now());
        when(subscriptionRepository.findById(subscriptionId)).thenReturn(Optional.of(subscription));
        when(subscriptionRepository.save(any(RestaurantSubscription.class))).thenAnswer(call -> call.getArgument(0));

        subscriptionService.expireIfEligible(subscriptionId, Instant.now().plusSeconds(1));
        assertEquals("EXPIRED", subscription.getStatus());
        assertNotNull(subscription.getEndedAt());
        subscriptionService.expireIfEligible(subscriptionId, Instant.now().plusSeconds(2));
        verify(eventRepository).save(any());
        verify(auditLogRepository).save(any());

        ResponseStatusException invalid = assertThrows(ResponseStatusException.class,
                () -> subscriptionService.transitionSubscription(subscriptionId,
                        new TransitionSubscriptionRequest("TRIALING", "Invalid reverse", null),
                        UUID.randomUUID()));
        assertEquals(HttpStatus.CONFLICT, invalid.getStatusCode());
    }

    @Test
    void trialCannotBeAssignedMoreThanOnce() {
        UUID restaurantDbId = UUID.randomUUID();
        UUID planId = UUID.randomUUID();
        Restaurant restaurant = restaurant(restaurantDbId, "DF-TRIAL-ONCE", "Trial Bistro");
        SubscriptionPlan plan = plan(planId, "TRIAL_PLAN");
        when(restaurantRepository.findByRestaurantId("DF-TRIAL-ONCE")).thenReturn(Optional.of(restaurant));
        when(planRepository.findById(planId)).thenReturn(Optional.of(plan));
        when(planFeatureRepository.findAllByPlanId(planId)).thenReturn(List.of());
        when(subscriptionRepository.existsByRestaurantIdAndTrialStartsAtIsNotNull(restaurantDbId))
                .thenReturn(true);

        ResponseStatusException duplicate = assertThrows(ResponseStatusException.class,
                () -> subscriptionService.assignSubscription("DF-TRIAL-ONCE",
                        new AssignSubscriptionRequest(planId, "TRIALING", null, null,
                                null, null, null, "Duplicate trial"), UUID.randomUUID()));
        assertEquals(HttpStatus.CONFLICT, duplicate.getStatusCode());
        verify(subscriptionRepository, never()).saveAndFlush(any(RestaurantSubscription.class));
    }

    @ParameterizedTest
    @CsvSource({
            "TRIALING, ACTIVE",
            "TRIALING, CANCELLED",
            "TRIALING, SUSPENDED",
            "ACTIVE, PAST_DUE",
            "ACTIVE, CANCELLED",
            "ACTIVE, SUSPENDED",
            "PAST_DUE, ACTIVE",
            "PAST_DUE, CANCELLED",
            "PAST_DUE, SUSPENDED",
            "CANCELLED, ACTIVE",
            "CANCELLED, SUSPENDED",
            "SUSPENDED, ACTIVE",
            "SUSPENDED, PAST_DUE",
            "SUSPENDED, CANCELLED"
    })
    void acceptsSupportedLifecycleTransitions(String from, String to) {
        UUID subscriptionId = UUID.randomUUID();
        UUID planId = UUID.randomUUID();
        UUID restaurantId = UUID.randomUUID();
        Instant now = Instant.now();
        RestaurantSubscription subscription = new RestaurantSubscription();
        subscription.setId(subscriptionId);
        subscription.setRestaurantId(restaurantId);
        subscription.setPlanId(planId);
        subscription.setStatus(from);
        subscription.setBillingPeriod("MONTHLY");
        subscription.setStartsAt(now.minus(1, ChronoUnit.DAYS));
        subscription.setCurrentPeriodStart(now.minus(1, ChronoUnit.DAYS));
        subscription.setCurrentPeriodEnd(now.plus(10, ChronoUnit.DAYS));
        subscription.setTrialEndsAt(now.plus(10, ChronoUnit.DAYS));
        SubscriptionPlan plan = plan(planId, "TRANSITION_PLAN");
        Restaurant restaurant = restaurant(restaurantId, "DF-TRANSITION", "Transition Bistro");
        when(subscriptionRepository.findById(subscriptionId)).thenReturn(Optional.of(subscription));
        when(subscriptionRepository.saveAndFlush(any(RestaurantSubscription.class)))
                .thenAnswer(call -> call.getArgument(0));
        when(planRepository.findById(planId)).thenReturn(Optional.of(plan));
        when(restaurantRepository.findById(restaurantId)).thenReturn(Optional.of(restaurant));

        var transitioned = subscriptionService.transitionSubscription(subscriptionId,
                new TransitionSubscriptionRequest(to, "Transition test", null), UUID.randomUUID());

        assertEquals(to, transitioned.status());
    }

    @ParameterizedTest
    @CsvSource({
            "ACTIVE, PERIOD",
            "CANCELLED, PERIOD",
            "PAST_DUE, GRACE"
    })
    void expiresPaidPeriodsAndPastDueGrace(String status, String expiryKind) {
        UUID subscriptionId = UUID.randomUUID();
        RestaurantSubscription subscription = new RestaurantSubscription();
        subscription.setId(subscriptionId);
        subscription.setRestaurantId(UUID.randomUUID());
        subscription.setStatus(status);
        Instant expiredAt = Instant.now().minus(1, ChronoUnit.SECONDS);
        if ("GRACE".equals(expiryKind)) {
            subscription.setGracePeriodEndsAt(expiredAt);
        } else {
            subscription.setCurrentPeriodEnd(expiredAt);
        }
        when(subscriptionRepository.findById(subscriptionId)).thenReturn(Optional.of(subscription));
        when(subscriptionRepository.save(any(RestaurantSubscription.class))).thenAnswer(call -> call.getArgument(0));

        subscriptionService.expireIfEligible(subscriptionId, Instant.now());
        subscriptionService.expireIfEligible(subscriptionId, Instant.now().plusSeconds(1));

        assertEquals("EXPIRED", subscription.getStatus());
        verify(eventRepository, times(1)).save(any());
        verify(auditLogRepository, times(1)).save(any());
    }

    @Test
    void overridesRequireReasonAndRespectValidityAndRevocation() {
        UUID actorId = UUID.randomUUID();
        UUID restaurantDbId = UUID.randomUUID();
        UUID overrideId = UUID.randomUUID();
        Restaurant restaurant = restaurant(restaurantDbId, "DF-OVERRIDE", "Override Bistro");
        Feature feature = feature("ANALYTICS", false);
        when(restaurantRepository.findByRestaurantId("DF-OVERRIDE")).thenReturn(Optional.of(restaurant));
        when(featureRepository.findById("ANALYTICS")).thenReturn(Optional.of(feature));
        when(overrideRepository.save(any(EntitlementOverride.class))).thenAnswer(call -> {
            EntitlementOverride saved = call.getArgument(0);
            saved.setId(overrideId);
            saved.setCreatedAt(Instant.now());
            saved.setUpdatedAt(Instant.now());
            return saved;
        });
        Instant now = Instant.now();
        var created = subscriptionService.createOverride("DF-OVERRIDE",
                new EntitlementOverrideRequest("analytics", true, "Temporary access",
                        now.minusSeconds(5), now.plus(1, ChronoUnit.HOURS)), actorId);
        assertTrue(created.enabled());
        EntitlementOverride storedOverride = override(overrideId, restaurantDbId, "ANALYTICS", true);
        EntitlementOverride newerOverride = override(UUID.randomUUID(), restaurantDbId, "ANALYTICS", false);
        newerOverride.setValidFrom(now);
        when(overrideRepository.findById(overrideId)).thenReturn(Optional.of(storedOverride));
        when(overrideRepository.findCurrentlyValid(any(), any(), any()))
                .thenReturn(List.of(newerOverride, storedOverride), List.of());
        var current = subscriptionService.findCurrentOverride("DF-OVERRIDE", "ANALYTICS").orElseThrow();
        assertEquals(newerOverride.getId(), current.id());
        assertEquals(false, current.enabled());
        var revoked = subscriptionService.revokeOverride(overrideId,
                new RegistrationDecisionRequest("No longer needed"), actorId);
        assertNotNull(revoked.revokedAt());
        assertTrue(subscriptionService.findCurrentOverride("DF-OVERRIDE", "ANALYTICS").isEmpty());
    }

    @Test
    void plansRejectUnknownFeaturesAndUnsupportedLimits() {
        UUID actorId = UUID.randomUUID();
        when(featureRepository.findById("MISSING")).thenReturn(Optional.empty());
        ResponseStatusException unknown = assertThrows(ResponseStatusException.class,
                () -> subscriptionService.createPlan(new SubscriptionPlanRequest(
                        "bad-plan", "Bad plan", null, true, false,
                        List.of(new PlanFeatureRequest("MISSING", true, Map.of()))), actorId));
        assertEquals(HttpStatus.NOT_FOUND, unknown.getStatusCode());

        when(featureRepository.findById("NO_LIMITS")).thenReturn(Optional.of(feature("NO_LIMITS", false)));
        ResponseStatusException invalidLimit = assertThrows(ResponseStatusException.class,
                () -> subscriptionService.createPlan(new SubscriptionPlanRequest(
                        "bad-limits", "Bad limits", null, true, false,
                        List.of(new PlanFeatureRequest("NO_LIMITS", true, Map.of("max", 2)))), actorId));
        assertEquals(HttpStatus.BAD_REQUEST, invalidLimit.getStatusCode());
    }

    private Feature feature(String key, boolean supportsLimits) {
        Feature feature = new Feature();
        feature.setFeatureKey(key);
        feature.setName(key);
        feature.setDescription(key + " description");
        feature.setCategory("TEST");
        feature.setActive(true);
        feature.setLimitsSupported(supportsLimits);
        return feature;
    }

    private PlanFeature planFeature(UUID planId, String featureKey, boolean enabled, Map<String, Object> limits) {
        PlanFeature mapping = new PlanFeature();
        mapping.setPlanId(planId);
        mapping.setFeatureKey(featureKey);
        mapping.setEnabled(enabled);
        mapping.setLimits(limits);
        return mapping;
    }

    private SubscriptionPlan plan(UUID id, String key) {
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setId(id);
        plan.setPlanKey(key);
        plan.setName(key);
        plan.setActive(true);
        plan.setCreatedAt(Instant.now());
        plan.setUpdatedAt(Instant.now());
        return plan;
    }

    private Restaurant restaurant(UUID id, String restaurantId, String name) {
        Restaurant restaurant = new Restaurant();
        restaurant.setId(id);
        restaurant.setRestaurantId(restaurantId);
        restaurant.setName(name);
        restaurant.setStatus("ACTIVE");
        restaurant.setCreatedAt(Instant.now());
        restaurant.setUpdatedAt(Instant.now());
        return restaurant;
    }

    private EntitlementOverride override(
            UUID id, UUID restaurantId, String featureKey, boolean enabled) {
        EntitlementOverride override = new EntitlementOverride();
        override.setId(id);
        override.setRestaurantId(restaurantId);
        override.setFeatureKey(featureKey);
        override.setEnabled(enabled);
        override.setReason("Temporary access");
        override.setValidFrom(Instant.now().minusSeconds(1));
        override.setCreatedBy(UUID.randomUUID());
        return override;
    }
}
