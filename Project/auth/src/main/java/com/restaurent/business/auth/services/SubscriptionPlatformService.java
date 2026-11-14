package com.restaurent.business.auth.services;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import io.micrometer.core.instrument.Metrics;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.restaurent.business.auth.entities.AuditLog;
import com.restaurent.business.auth.entities.EntitlementOverride;
import com.restaurent.business.auth.entities.Feature;
import com.restaurent.business.auth.entities.PlanFeature;
import com.restaurent.business.auth.entities.Restaurant;
import com.restaurent.business.auth.entities.RestaurantSubscription;
import com.restaurent.business.auth.entities.SubscriptionEvent;
import com.restaurent.business.auth.entities.SubscriptionPlan;
import com.restaurent.business.auth.entities.dto.AssignSubscriptionRequest;
import com.restaurent.business.auth.entities.dto.EntitlementOverrideRequest;
import com.restaurent.business.auth.entities.dto.EntitlementOverrideResponse;
import com.restaurent.business.auth.entities.dto.FeatureRequest;
import com.restaurent.business.auth.entities.dto.FeatureResponse;
import com.restaurent.business.auth.entities.dto.PlanFeatureRequest;
import com.restaurent.business.auth.entities.dto.RegistrationDecisionRequest;
import com.restaurent.business.auth.entities.dto.SubscriptionPlanRequest;
import com.restaurent.business.auth.entities.dto.SubscriptionPlanResponse;
import com.restaurent.business.auth.entities.dto.SubscriptionResponse;
import com.restaurent.business.auth.entities.dto.TransitionSubscriptionRequest;
import com.restaurent.business.auth.repos.AuditLogRepository;
import com.restaurent.business.auth.repos.EntitlementOverrideRepository;
import com.restaurent.business.auth.repos.FeatureRepository;
import com.restaurent.business.auth.repos.PlanFeatureRepository;
import com.restaurent.business.auth.repos.RestaurantRepository;
import com.restaurent.business.auth.repos.RestaurantSubscriptionRepository;
import com.restaurent.business.auth.repos.SubscriptionEventRepository;
import com.restaurent.business.auth.repos.SubscriptionPlanRepository;

@Service
public class SubscriptionPlatformService {

    private static final Logger LOGGER = LoggerFactory.getLogger(SubscriptionPlatformService.class);

    private static final int TRIAL_DAYS = 14;
    private static final int PAST_DUE_GRACE_DAYS = 7;
    private final FeatureRepository featureRepository;
    private final SubscriptionPlanRepository planRepository;
    private final PlanFeatureRepository planFeatureRepository;
    private final RestaurantRepository restaurantRepository;
    private final RestaurantSubscriptionRepository subscriptionRepository;
    private final SubscriptionEventRepository eventRepository;
    private final EntitlementOverrideRepository overrideRepository;
    private final AuditLogRepository auditLogRepository;
    private final AuthorizationVersionService authorizationVersionService;

    public SubscriptionPlatformService(
            FeatureRepository featureRepository,
            SubscriptionPlanRepository planRepository,
            PlanFeatureRepository planFeatureRepository,
            RestaurantRepository restaurantRepository,
            RestaurantSubscriptionRepository subscriptionRepository,
            SubscriptionEventRepository eventRepository,
            EntitlementOverrideRepository overrideRepository,
            AuditLogRepository auditLogRepository,
            AuthorizationVersionService authorizationVersionService) {
        this.featureRepository = featureRepository;
        this.planRepository = planRepository;
        this.planFeatureRepository = planFeatureRepository;
        this.restaurantRepository = restaurantRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.eventRepository = eventRepository;
        this.overrideRepository = overrideRepository;
        this.auditLogRepository = auditLogRepository;
        this.authorizationVersionService = authorizationVersionService;
    }

    @Transactional(readOnly = true)
    public List<FeatureResponse> listFeatures() {
        return featureRepository.findAll().stream().map(FeatureResponse::from).toList();
    }

    @Transactional
    public FeatureResponse createFeature(FeatureRequest request, UUID actorId) {
        String key = normalizeKey(request.featureKey());
        if (featureRepository.existsById(key)) {
            throw conflict("Feature keys are permanent and cannot be reused");
        }
        Feature feature = new Feature();
        feature.setFeatureKey(key);
        applyFeature(feature, request);
        try {
            feature = featureRepository.saveAndFlush(feature);
        } catch (DataIntegrityViolationException exception) {
            throw conflict("Feature key already exists");
        }
        writeAudit(actorId, null, "FEATURE_CREATED", "FEATURE", key, null,
                featureAuditDetails(feature));
        authorizationVersionService.invalidate("FEATURE", key);
        return FeatureResponse.from(feature);
    }

    @Transactional
    public FeatureResponse updateFeature(String featureKey, FeatureRequest request, UUID actorId) {
        String key = normalizeKey(featureKey);
        if (!key.equals(normalizeKey(request.featureKey()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Feature keys are immutable");
        }
        Feature feature = featureRepository.findById(key)
                .orElseThrow(() -> notFound("Feature not found"));
        applyFeature(feature, request);
        feature = featureRepository.save(feature);
        writeAudit(actorId, null, "FEATURE_UPDATED", "FEATURE", key, null,
                featureAuditDetails(feature));
        authorizationVersionService.invalidate("FEATURE", key);
        return FeatureResponse.from(feature);
    }

    @Transactional(readOnly = true)
    public List<SubscriptionPlanResponse> listPlans() {
        return planRepository.findAll().stream().map(this::planResponse).toList();
    }

    @Transactional
    public SubscriptionPlanResponse createPlan(SubscriptionPlanRequest request, UUID actorId) {
        String key = normalizePlanKey(request.planKey());
        if (planRepository.findByPlanKey(key).isPresent()) {
            throw conflict("Plan key already exists");
        }
        validatePlanFeatures(request.features());
        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setPlanKey(key);
        applyPlan(plan, request);
        try {
            plan = planRepository.saveAndFlush(plan);
        } catch (DataIntegrityViolationException exception) {
            throw conflict("Plan key already exists");
        }
        replacePlanFeatures(plan.getId(), request.features());
        writeAudit(actorId, null, "SUBSCRIPTION_PLAN_CREATED", "SUBSCRIPTION_PLAN",
                plan.getId().toString(), null, planAuditDetails(plan, request.features()));
        return planResponse(plan);
    }

    @Transactional
    public SubscriptionPlanResponse updatePlan(UUID planId, SubscriptionPlanRequest request, UUID actorId) {
        SubscriptionPlan plan = planRepository.findById(planId)
                .orElseThrow(() -> notFound("Subscription plan not found"));
        if (!plan.getPlanKey().equals(normalizePlanKey(request.planKey()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Plan keys are immutable");
        }
        validatePlanFeatures(request.features());
        applyPlan(plan, request);
        plan = planRepository.saveAndFlush(plan);
        planFeatureRepository.deleteAllByPlanId(planId);
        planFeatureRepository.flush();
        replacePlanFeatures(planId, request.features());
        writeAudit(actorId, null, "SUBSCRIPTION_PLAN_UPDATED", "SUBSCRIPTION_PLAN",
                planId.toString(), null, planAuditDetails(plan, request.features()));
        return planResponse(plan);
    }

    @Transactional(readOnly = true)
    public List<SubscriptionResponse> listSubscriptions(String restaurantId) {
        Restaurant restaurant = restaurant(restaurantId);
        return subscriptionRepository.findAllByRestaurantIdOrderByCreatedAtDesc(restaurant.getId())
                .stream().map(this::subscriptionResponse).toList();
    }

    @Transactional
    public SubscriptionResponse assignSubscription(
            String restaurantId, AssignSubscriptionRequest request, UUID actorId) {
        Restaurant restaurant = restaurant(restaurantId);
        SubscriptionPlan plan = planRepository.findById(request.planId())
                .orElseThrow(() -> notFound("Subscription plan not found"));
        if (!plan.isActive()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Inactive plans cannot be assigned");
        }
        List<PlanFeature> planFeatures = planFeatureRepository.findAllByPlanId(plan.getId());
        Map<String, Object> snapshot = snapshot(planFeatures);
        Instant now = Instant.now();
        String status = request.status() == null ? "TRIALING" : request.status();
        String billingPeriod = request.billingPeriod() == null ? "CUSTOM" : request.billingPeriod();
        Instant startsAt = request.startsAt() == null ? now : request.startsAt();
        Instant periodStart = request.currentPeriodStart() == null ? startsAt : request.currentPeriodStart();
        Instant trialEnd = null;
        Instant periodEnd = request.currentPeriodEnd();

        if (!List.of("TRIALING", "ACTIVE").contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported subscription status");
        }
        if (status.equals("TRIALING")) {
            if (subscriptionRepository.existsByRestaurantIdAndTrialStartsAtIsNotNull(restaurant.getId())) {
                throw conflict("A restaurant may use its trial only once");
            }
            trialEnd = request.trialEndsAt() == null ? startsAt.plus(TRIAL_DAYS, ChronoUnit.DAYS)
                    : request.trialEndsAt();
            if (!trialEnd.isAfter(startsAt)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Trial end must be after the subscription start");
            }
            if (periodEnd == null) periodEnd = trialEnd;
        } else {
            if (periodEnd == null) {
                periodEnd = switch (billingPeriod) {
                    case "MONTHLY" -> periodStart.atZone(ZoneOffset.UTC).plusMonths(1).toInstant();
                    case "ANNUAL" -> periodStart.atZone(ZoneOffset.UTC).plusYears(1).toInstant();
                    default -> null;
                };
            }
            if (periodEnd == null || !periodEnd.isAfter(periodStart)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "A future billing period end is required for custom periods");
            }
        }
        if (periodEnd != null && !periodEnd.isAfter(periodStart)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Subscription period end must be after its start");
        }

        RestaurantSubscription subscription = new RestaurantSubscription();
        subscription.setRestaurantId(restaurant.getId());
        subscription.setPlanId(plan.getId());
        subscription.setEntitlementsSnapshot(snapshot);
        subscription.setStatus(status);
        subscription.setBillingPeriod(billingPeriod);
        subscription.setStartsAt(startsAt);
        subscription.setCurrentPeriodStart(periodStart);
        subscription.setCurrentPeriodEnd(periodEnd);
        subscription.setTrialStartsAt(trialEnd == null ? null : startsAt);
        subscription.setTrialEndsAt(trialEnd);
        try {
            subscription = subscriptionRepository.saveAndFlush(subscription);
        } catch (DataIntegrityViolationException exception) {
            throw conflict("Restaurant already has an open subscription");
        }
        recordSubscriptionChange(subscription, null, status, actorId,
                clean(request.reason()), "SUBSCRIPTION_ASSIGNED",
                Map.of("planKey", plan.getPlanKey(), "snapshotFeatureCount", snapshot.size()));
        authorizationVersionService.invalidate("RESTAURANT", restaurant.getRestaurantId());
        return subscriptionResponse(subscription);
    }

    @Transactional
    public SubscriptionResponse transitionSubscription(
            UUID subscriptionId, TransitionSubscriptionRequest request, UUID actorId) {
        RestaurantSubscription subscription = subscription(subscriptionId);
        String target = request.status();
        String current = subscription.getStatus();
        if (!allowedTransition(current, target)) {
            throw conflict("Subscription cannot transition from " + current + " to " + target);
        }
        Instant now = Instant.now();
        if ("CANCELLED".equals(target)) {
            if (subscription.getCurrentPeriodEnd() == null) {
                if (subscription.getTrialEndsAt() == null) {
                    throw conflict("A paid-through end date is required before cancellation");
                }
                subscription.setCurrentPeriodEnd(subscription.getTrialEndsAt());
            }
            subscription.setCancelledAt(now);
        } else if ("PAST_DUE".equals(target)) {
            subscription.setGracePeriodEndsAt(now.plus(PAST_DUE_GRACE_DAYS, ChronoUnit.DAYS));
        } else if ("ACTIVE".equals(target)) {
            if ("CANCELLED".equals(current) && due(subscription.getCurrentPeriodEnd(), now)) {
                throw conflict("A cancelled subscription cannot be reactivated after its paid-through date");
            }
            Instant periodStart = now;
            Instant periodEnd = request.currentPeriodEnd();
            if (periodEnd == null) {
                periodEnd = switch (subscription.getBillingPeriod()) {
                    case "MONTHLY" -> now.atZone(ZoneOffset.UTC).plusMonths(1).toInstant();
                    case "ANNUAL" -> now.atZone(ZoneOffset.UTC).plusYears(1).toInstant();
                    default -> null;
                };
            }
            if (periodEnd == null || !periodEnd.isAfter(periodStart)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "A future period end is required for custom billing periods");
            }
            subscription.setCurrentPeriodStart(periodStart);
            subscription.setCurrentPeriodEnd(periodEnd);
            subscription.setGracePeriodEndsAt(null);
            subscription.setCancelledAt(null);
        } else if ("SUSPENDED".equals(target)) {
            subscription.setGracePeriodEndsAt(null);
        }
        subscription.setStatus(target);
        String reason = requiredReason(request.reason());
        subscription = subscriptionRepository.saveAndFlush(subscription);
        recordSubscriptionChange(subscription, current, target, actorId, reason,
                "SUBSCRIPTION_STATUS_CHANGED", Map.of());
        Metrics.counter("dineflow.subscription.transition", "from", current, "to", target).increment();
        LOGGER.info("event=subscription_transition subscriptionId={} restaurantId={} from={} to={} actorId={}",
                subscription.getId(), subscription.getRestaurantId(), current, target, actorId);
        invalidateRestaurant(subscription.getRestaurantId());
        return subscriptionResponse(subscription);
    }

    @Transactional(readOnly = true)
    public List<EntitlementOverrideResponse> listOverrides(String restaurantId) {
        Restaurant restaurant = restaurant(restaurantId);
        return overrideRepository.findAllByRestaurantIdOrderByCreatedAtDesc(restaurant.getId())
                .stream().map(EntitlementOverrideResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public Optional<EntitlementOverrideResponse> findCurrentOverride(String restaurantId, String featureKey) {
        Restaurant restaurant = restaurant(restaurantId);
        String key = normalizeKey(featureKey);
        return overrideRepository.findCurrentlyValid(restaurant.getId(), key, Instant.now()).stream()
                .findFirst().map(EntitlementOverrideResponse::from);
    }

    @Transactional
    public EntitlementOverrideResponse createOverride(
            String restaurantId, EntitlementOverrideRequest request, UUID actorId) {
        Restaurant restaurant = restaurant(restaurantId);
        Feature feature = activeFeature(request.featureKey());
        Instant now = Instant.now();
        Instant from = request.validFrom() == null ? now : request.validFrom();
        validateWindow(from, request.validUntil());
        EntitlementOverride override = new EntitlementOverride();
        override.setRestaurantId(restaurant.getId());
        override.setFeatureKey(feature.getFeatureKey());
        override.setEnabled(request.enabled());
        override.setReason(requiredReason(request.reason()));
        override.setValidFrom(from);
        override.setValidUntil(request.validUntil());
        override.setCreatedBy(actorId);
        override = overrideRepository.save(override);
        writeAudit(actorId, restaurant.getId(), "ENTITLEMENT_OVERRIDE_CREATED",
                "ENTITLEMENT_OVERRIDE", override.getId().toString(), override.getReason(),
                overrideAuditDetails(override));
        authorizationVersionService.invalidate("RESTAURANT", restaurant.getRestaurantId());
        return EntitlementOverrideResponse.from(override);
    }

    @Transactional
    public EntitlementOverrideResponse updateOverride(
            UUID overrideId, EntitlementOverrideRequest request, UUID actorId) {
        EntitlementOverride override = override(overrideId);
        if (override.getRevokedAt() != null) {
            throw conflict("A revoked entitlement override cannot be changed");
        }
        Feature feature = activeFeature(request.featureKey());
        Instant from = request.validFrom() == null ? override.getValidFrom() : request.validFrom();
        validateWindow(from, request.validUntil());
        override.setFeatureKey(feature.getFeatureKey());
        override.setEnabled(request.enabled());
        override.setReason(requiredReason(request.reason()));
        override.setValidFrom(from);
        override.setValidUntil(request.validUntil());
        override.setUpdatedBy(actorId);
        override = overrideRepository.save(override);
        writeAudit(actorId, override.getRestaurantId(), "ENTITLEMENT_OVERRIDE_UPDATED",
                "ENTITLEMENT_OVERRIDE", override.getId().toString(), override.getReason(),
                overrideAuditDetails(override));
        invalidateRestaurant(override.getRestaurantId());
        return EntitlementOverrideResponse.from(override);
    }

    @Transactional
    public EntitlementOverrideResponse revokeOverride(
            UUID overrideId, RegistrationDecisionRequest decision, UUID actorId) {
        EntitlementOverride override = override(overrideId);
        if (override.getRevokedAt() != null) {
            throw conflict("Entitlement override is already revoked");
        }
        override.setRevokedAt(Instant.now());
        override.setUpdatedBy(actorId);
        override.setReason(requiredReason(decision.reason()));
        override = overrideRepository.save(override);
        writeAudit(actorId, override.getRestaurantId(), "ENTITLEMENT_OVERRIDE_REVOKED",
                "ENTITLEMENT_OVERRIDE", override.getId().toString(), override.getReason(),
                overrideAuditDetails(override));
        invalidateRestaurant(override.getRestaurantId());
        return EntitlementOverrideResponse.from(override);
    }

    @Transactional
    public void expireIfEligible(UUID subscriptionId, Instant now) {
        RestaurantSubscription subscription = subscriptionRepository.findById(subscriptionId).orElse(null);
        if (subscription == null || "EXPIRED".equals(subscription.getStatus())) return;
        String status = subscription.getStatus();
        boolean eligible = ("TRIALING".equals(status) && due(subscription.getTrialEndsAt(), now))
                || (("ACTIVE".equals(status) || "CANCELLED".equals(status))
                    && due(subscription.getCurrentPeriodEnd(), now))
                || ("PAST_DUE".equals(status) && due(subscription.getGracePeriodEndsAt(), now));
        if (!eligible) return;
        subscription.setStatus("EXPIRED");
        subscription.setEndedAt(now);
        subscription.setGracePeriodEndsAt(null);
        subscriptionRepository.save(subscription);
        recordSubscriptionChange(subscription, status, "EXPIRED", null, "Subscription period ended",
                "SUBSCRIPTION_EXPIRED", Map.of("scheduled", true));
        Metrics.counter("dineflow.subscription.transition", "from", status, "to", "EXPIRED").increment();
        LOGGER.info("event=subscription_expired subscriptionId={} restaurantId={} from={} to=EXPIRED",
                subscription.getId(), subscription.getRestaurantId(), status);
        invalidateRestaurant(subscription.getRestaurantId());
    }

    private boolean due(Instant date, Instant now) {
        return date != null && !date.isAfter(now);
    }

    private boolean allowedTransition(String from, String to) {
        return switch (from) {
            case "TRIALING" -> List.of("ACTIVE", "CANCELLED", "SUSPENDED").contains(to);
            case "ACTIVE" -> List.of("PAST_DUE", "CANCELLED", "SUSPENDED").contains(to);
            case "PAST_DUE" -> List.of("ACTIVE", "CANCELLED", "SUSPENDED").contains(to);
            case "CANCELLED" -> List.of("ACTIVE", "SUSPENDED").contains(to);
            case "SUSPENDED" -> List.of("ACTIVE", "PAST_DUE", "CANCELLED").contains(to);
            default -> false;
        };
    }

    private void validatePlanFeatures(List<PlanFeatureRequest> requestedFeatures) {
        List<String> keys = new ArrayList<>();
        for (PlanFeatureRequest requested : requestedFeatures) {
            String key = normalizeKey(requested.featureKey());
            if (keys.contains(key)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "A feature may appear only once in a plan");
            keys.add(key);
            Feature feature = featureRepository.findById(key)
                    .orElseThrow(() -> notFound("Unknown feature key: " + key));
            Map<String, Object> limits = requested.limits() == null ? Map.of() : requested.limits();
            if (!limits.isEmpty() && !feature.isLimitsSupported()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Feature does not support limits: " + key);
            }
            if (!feature.isActive() && requested.enabled()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Inactive features cannot be enabled in a plan: " + key);
            }
        }
    }

    private void replacePlanFeatures(UUID planId, List<PlanFeatureRequest> requestedFeatures) {
        List<PlanFeature> mappings = requestedFeatures.stream().map(requested -> {
            PlanFeature mapping = new PlanFeature();
            mapping.setPlanId(planId);
            mapping.setFeatureKey(normalizeKey(requested.featureKey()));
            mapping.setEnabled(requested.enabled());
            mapping.setLimits(requested.limits() == null
                    ? new HashMap<>() : new HashMap<>(requested.limits()));
            return mapping;
        }).toList();
        planFeatureRepository.saveAll(mappings);
    }

    private Map<String, Object> snapshot(List<PlanFeature> planFeatures) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (PlanFeature mapping : planFeatures) {
            Feature feature = featureRepository.findById(mapping.getFeatureKey())
                    .orElseThrow(() -> notFound("Unknown feature key: " + mapping.getFeatureKey()));
            if (mapping.isEnabled() && !feature.isActive()) {
                throw conflict("Plan references an inactive feature: " + feature.getFeatureKey());
            }
            Map<String, Object> entitlement = new LinkedHashMap<>();
            entitlement.put("enabled", mapping.isEnabled());
            entitlement.put("limits", mapping.getLimits() == null ? Map.of() : mapping.getLimits());
            result.put(mapping.getFeatureKey(), entitlement);
        }
        return result;
    }

    private void applyFeature(Feature feature, FeatureRequest request) {
        feature.setName(normalize(request.name()));
        feature.setDescription(normalize(request.description()));
        feature.setCategory(normalize(request.category()));
        feature.setActive(request.active());
        feature.setLimitsSupported(request.limitsSupported());
    }

    private void applyPlan(SubscriptionPlan plan, SubscriptionPlanRequest request) {
        plan.setName(normalize(request.name()));
        plan.setDescription(clean(request.description()));
        plan.setActive(request.active());
        plan.setCustomPlan(request.customPlan());
    }

    private SubscriptionPlanResponse planResponse(SubscriptionPlan plan) {
        List<SubscriptionPlanResponse.PlanFeature> features =
                planFeatureRepository.findAllByPlanId(plan.getId()).stream()
                        .map(feature -> new SubscriptionPlanResponse.PlanFeature(
                                feature.getFeatureKey(), feature.isEnabled(), feature.getLimits()))
                        .toList();
        return new SubscriptionPlanResponse(plan.getId(), plan.getPlanKey(), plan.getName(),
                plan.getDescription(), plan.isActive(), plan.isCustomPlan(), features,
                plan.getCreatedAt(), plan.getUpdatedAt());
    }

    private Map<String, Object> planAuditDetails(
            SubscriptionPlan plan, List<PlanFeatureRequest> features) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("planKey", plan.getPlanKey());
        details.put("active", plan.isActive());
        details.put("customPlan", plan.isCustomPlan());
        details.put("features", features.stream().map(feature -> Map.of(
                "featureKey", normalizeKey(feature.featureKey()),
                "enabled", feature.enabled(),
                "limits", feature.limits() == null ? Map.of() : feature.limits())).toList());
        return details;
    }

    private Map<String, Object> featureAuditDetails(Feature feature) {
        return Map.of(
                "name", feature.getName(),
                "description", feature.getDescription(),
                "category", feature.getCategory(),
                "active", feature.isActive(),
                "limitsSupported", feature.isLimitsSupported());
    }

    private Map<String, Object> overrideAuditDetails(EntitlementOverride override) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("featureKey", override.getFeatureKey());
        details.put("enabled", override.isEnabled());
        details.put("validFrom", override.getValidFrom().toString());
        if (override.getValidUntil() != null) {
            details.put("validUntil", override.getValidUntil().toString());
        }
        return details;
    }

    private SubscriptionResponse subscriptionResponse(RestaurantSubscription subscription) {
        SubscriptionPlan plan = planRepository.findById(subscription.getPlanId())
                .orElseThrow(() -> notFound("Subscription plan not found"));
        Restaurant restaurant = restaurantRepository.findById(subscription.getRestaurantId())
                .orElseThrow(() -> notFound("Restaurant not found"));
        return new SubscriptionResponse(subscription.getId(), restaurant.getRestaurantId(),
                plan.getId(), plan.getPlanKey(), plan.getName(), subscription.getStatus(),
                subscription.getBillingPeriod(), subscription.getStartsAt(),
                subscription.getCurrentPeriodStart(), subscription.getCurrentPeriodEnd(),
                subscription.getTrialStartsAt(), subscription.getTrialEndsAt(),
                subscription.getGracePeriodEndsAt(), subscription.getCancelledAt(),
                subscription.getEndedAt(), subscription.getEntitlementsSnapshot(),
                subscription.getCreatedAt(), subscription.getUpdatedAt());
    }

    private void recordSubscriptionChange(
            RestaurantSubscription subscription,
            String from,
            String to,
            UUID actorId,
            String reason,
            String eventType,
            Map<String, Object> details) {
        SubscriptionEvent event = new SubscriptionEvent();
        event.setSubscriptionId(subscription.getId());
        event.setRestaurantId(subscription.getRestaurantId());
        event.setEventType(eventType);
        event.setFromStatus(from);
        event.setToStatus(to);
        event.setActorId(actorId);
        event.setReason(reason);
        event.setDetails(new HashMap<>(details));
        eventRepository.save(event);
        writeAudit(actorId, subscription.getRestaurantId(), eventType,
                "RESTAURANT_SUBSCRIPTION", subscription.getId().toString(), reason, details);
    }

    private void writeAudit(UUID actorId, UUID restaurantId, String action,
            String resourceType, String resourceId, String reason, Map<String, Object> details) {
        AuditLog audit = new AuditLog();
        audit.setActorId(actorId);
        audit.setRestaurantId(restaurantId);
        audit.setAction(action);
        audit.setResourceType(resourceType);
        audit.setResourceId(resourceId);
        audit.setReason(reason);
        audit.setDetails(new HashMap<>(details));
        auditLogRepository.save(audit);
    }

    private Restaurant restaurant(String restaurantId) {
        return restaurantRepository.findByRestaurantId(normalize(restaurantId))
                .orElseThrow(() -> notFound("Restaurant not found"));
    }

    private void invalidateRestaurant(UUID restaurantId) {
        restaurantRepository.findById(restaurantId).ifPresent(restaurant ->
                authorizationVersionService.invalidate("RESTAURANT", restaurant.getRestaurantId()));
    }

    private RestaurantSubscription subscription(UUID id) {
        return subscriptionRepository.findById(id)
                .orElseThrow(() -> notFound("Subscription not found"));
    }

    private EntitlementOverride override(UUID id) {
        return overrideRepository.findById(id)
                .orElseThrow(() -> notFound("Entitlement override not found"));
    }

    private Feature activeFeature(String featureKey) {
        Feature feature = featureRepository.findById(normalizeKey(featureKey))
                .orElseThrow(() -> notFound("Feature not found"));
        if (!feature.isActive()) throw conflict("Inactive features cannot receive overrides");
        return feature;
    }

    private void validateWindow(Instant from, Instant until) {
        if (until != null && !until.isAfter(from)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Override end must be after its start");
        }
    }

    private String normalizeKey(String value) {
        return normalize(value).toUpperCase(Locale.ROOT);
    }

    private String normalizePlanKey(String value) {
        return normalize(value).toUpperCase(Locale.ROOT);
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    private String clean(String value) {
        String normalized = normalize(value);
        return normalized.isEmpty() ? null : normalized;
    }

    private String requiredReason(String value) {
        String reason = clean(value);
        if (reason == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A reason is required");
        }
        return reason;
    }

    private ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }

    private ResponseStatusException conflict(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }
}
