package com.restaurent.business.auth.services;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import io.micrometer.core.instrument.Metrics;
import org.springframework.transaction.annotation.Transactional;

import com.restaurent.business.auth.entities.EntitlementOverride;
import com.restaurent.business.auth.entities.Feature;
import com.restaurent.business.auth.entities.Restaurant;
import com.restaurent.business.auth.entities.RestaurantSubscription;
import com.restaurent.business.auth.entities.UserInfo;
import com.restaurent.business.auth.entities.dto.AccessCheckRequest;
import com.restaurent.business.auth.entities.dto.AccessCheckResponse;
import com.restaurent.business.auth.entities.dto.AccessContextResponse;
import com.restaurent.business.auth.entities.dto.AccessContextResponse.FeatureAccess;
import com.restaurent.business.auth.entities.dto.AccessContextResponse.NavigationItem;
import com.restaurent.business.auth.repos.EntitlementOverrideRepository;
import com.restaurent.business.auth.repos.FeatureRepository;
import com.restaurent.business.auth.repos.RestaurantRepository;
import com.restaurent.business.auth.repos.RestaurantSubscriptionRepository;
import com.restaurent.business.auth.services.UserInfoDetails;

@Service
public class EffectiveAccessService {

    private static final Logger LOGGER = LoggerFactory.getLogger(EffectiveAccessService.class);

    private static final Map<String, NavigationMetadata> NAVIGATION = Map.of(
            "MENU_MANAGEMENT", new NavigationMetadata("Menu", "/menu", "MENU_READ"),
            "ORDER_MANAGEMENT", new NavigationMetadata("Orders", "/orders", "ORDER_READ_ACTIVE"),
            "KITCHEN_DISPLAY", new NavigationMetadata("Kitchen", "/kitchen", "ORDER_READ_ACTIVE"),
            "WAITER_OPERATIONS", new NavigationMetadata("Waiter", "/waiter", "ORDER_CREATE"),
            "TABLE_QR_MANAGEMENT", new NavigationMetadata("Tables", "/tables", "TABLE_MANAGE"),
            "CASHIER_OPERATIONS", new NavigationMetadata("Payments", "/payments", "PAYMENT_PROCESS"),
            "ANALYTICS", new NavigationMetadata("Analytics", "/analytics", "TABLE_REVENUE_READ"));

    private final RestaurantRepository restaurantRepository;
    private final RestaurantSubscriptionRepository subscriptionRepository;
    private final FeatureRepository featureRepository;
    private final EntitlementOverrideRepository overrideRepository;
    private final AuthorizationVersionService versionService;

    public EffectiveAccessService(
            RestaurantRepository restaurantRepository,
            RestaurantSubscriptionRepository subscriptionRepository,
            FeatureRepository featureRepository,
            EntitlementOverrideRepository overrideRepository,
            AuthorizationVersionService versionService) {
        this.restaurantRepository = restaurantRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.featureRepository = featureRepository;
        this.overrideRepository = overrideRepository;
        this.versionService = versionService;
    }

    @Transactional(readOnly = true)
    public AccessContextResponse context(UserInfoDetails principal) {
        return resolve(principal).context();
    }

    @Transactional(readOnly = true)
    public AccessCheckResponse authorize(UserInfoDetails principal, AccessCheckRequest request) {
        Evaluation evaluation = resolve(principal, request.restaurantId());
        if (evaluation.denialCode() != null) {
            return denied(evaluation, request.featureKey(), request.permission());
        }

        FeatureAccess feature = evaluation.context().features().get(normalize(request.featureKey()));
        if (feature == null || !feature.enabled()) {
            logDenial(evaluation.context(), "FEATURE_DISABLED", request.featureKey(), request.permission());
            return new AccessCheckResponse(false, "FEATURE_DISABLED",
                    "The requested feature is not available for this restaurant.", evaluation.context());
        }
        if (!evaluation.context().permissions().contains(normalize(request.permission()))) {
            logDenial(evaluation.context(), "PERMISSION_DENIED", request.featureKey(), request.permission());
            return new AccessCheckResponse(false, "PERMISSION_DENIED",
                    "The authenticated user's role does not grant the requested permission.",
                    evaluation.context());
        }
        return new AccessCheckResponse(true, "ALLOWED", "Access granted.", evaluation.context());
    }

    private Evaluation resolve(UserInfoDetails principal) {
        return resolve(principal, null);
    }

    private Evaluation resolve(UserInfoDetails principal, String requestedRestaurantId) {
        UserInfo user = principal.getUserInfo();
        String role = user.getRole() == null ? null : user.getRole().getName();
        List<String> permissions = principal.getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .filter(authority -> !authority.equals(role))
                .sorted()
                .toList();
        Map<String, Long> versions = versionService.versions(
                user.getId(),
                user.getRestaurantId(),
                user.getRole() == null ? null : user.getRole().getId());

        String denialCode = null;
        String denialMessage = null;
        Restaurant restaurant = null;
        if (!user.isActive()) {
            denialCode = "USER_INACTIVE";
            denialMessage = "The authenticated user is inactive.";
        } else if (user.getRestaurantId() == null || user.getRestaurantId().isBlank()) {
            if (!"SUPER_ADMIN".equals(role)) {
                denialCode = "RESTAURANT_SCOPE_REQUIRED";
                denialMessage = "The authenticated user is not assigned to a restaurant.";
            } else if (requestedRestaurantId != null && !requestedRestaurantId.isBlank()) {
                denialCode = "RESTAURANT_SCOPE_REQUIRED";
                denialMessage = "Platform administrators cannot act as restaurant staff.";
            }
        } else if (requestedRestaurantId != null
                && !user.getRestaurantId().equals(requestedRestaurantId.trim())) {
            denialCode = "CROSS_TENANT_FORBIDDEN";
            denialMessage = "The requested restaurant does not match the user's membership.";
        } else {
            restaurant = restaurantRepository.findByRestaurantId(user.getRestaurantId()).orElse(null);
            if (restaurant == null) {
                denialCode = "RESTAURANT_NOT_FOUND";
                denialMessage = "The user's restaurant membership is invalid.";
            } else if (!"ACTIVE".equals(restaurant.getStatus())) {
                denialCode = "RESTAURANT_INACTIVE";
                denialMessage = "The restaurant is not active.";
            }
        }

        RestaurantSubscription subscription = restaurant == null
                ? null : currentSubscription(restaurant.getId());
        Instant now = Instant.now();
        boolean subscriptionActive = subscription != null && subscriptionAllowsAccess(subscription, now);
        if (denialCode == null && restaurant != null && !subscriptionActive) {
            denialCode = subscription == null ? "SUBSCRIPTION_REQUIRED" : "SUBSCRIPTION_INACTIVE";
            denialMessage = "The restaurant subscription does not currently permit access.";
        }

        Map<String, FeatureAccess> featureAccess = new LinkedHashMap<>();
        if (restaurant != null) {
            Map<String, Object> snapshot = subscription == null
                    ? Map.of() : subscription.getEntitlementsSnapshot();
            for (Feature feature : featureRepository.findAll()) {
                Object entitlementValue = snapshot.get(feature.getFeatureKey());
                Map<?, ?> entitlement = entitlementValue instanceof Map<?, ?> map ? map : Map.of();
                boolean planEnabled = Boolean.TRUE.equals(entitlement.get("enabled"));
                Map<String, Object> limits = stringMap(entitlement.get("limits"));
                Optional<EntitlementOverride> override = overrideRepository
                        .findCurrentlyValid(restaurant.getId(), feature.getFeatureKey(), now)
                        .stream().findFirst();
                boolean entitled = override.map(EntitlementOverride::isEnabled).orElse(planEnabled);
                boolean enabled = denialCode == null && feature.isActive() && subscriptionActive && entitled;
                featureAccess.put(feature.getFeatureKey(), new FeatureAccess(enabled, limits,
                        override.isPresent() ? "OVERRIDE" : planEnabled ? "PLAN" : "NONE"));
            }
        }

        List<NavigationItem> navigation = new ArrayList<>();
        for (Map.Entry<String, NavigationMetadata> item : NAVIGATION.entrySet()) {
            FeatureAccess feature = featureAccess.get(item.getKey());
            if (feature != null && feature.enabled()
                    && permissions.contains(item.getValue().requiredPermission())) {
                navigation.add(new NavigationItem(
                        item.getKey(), item.getValue().label(), item.getValue().path()));
            }
        }
        navigation.sort(Comparator.comparing(NavigationItem::label));
        if ("SUPER_ADMIN".equals(role) && restaurant == null && denialCode == null) {
            navigation.add(new NavigationItem("PLATFORM_ADMIN", "Platform", "/platform"));
        }

        AccessContextResponse context = new AccessContextResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                role,
                restaurant == null ? null : restaurant.getRestaurantId(),
                restaurant == null ? null : restaurant.getName(),
                subscription == null ? null : subscription.getStatus(),
                versions,
                Map.copyOf(featureAccess),
                permissions,
                List.copyOf(navigation));
        return new Evaluation(context, denialCode, denialMessage);
    }

    private RestaurantSubscription currentSubscription(UUID restaurantId) {
        return subscriptionRepository.findAllByRestaurantIdOrderByCreatedAtDesc(restaurantId).stream()
                .filter(subscription -> List.of(
                        "TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED", "SUSPENDED")
                        .contains(subscription.getStatus()))
                .findFirst()
                .orElse(null);
    }

    private boolean subscriptionAllowsAccess(RestaurantSubscription subscription, Instant now) {
        if (subscription.getStartsAt().isAfter(now)) return false;
        return switch (subscription.getStatus()) {
            case "TRIALING" -> after(subscription.getTrialEndsAt(), now);
            case "ACTIVE" -> after(subscription.getCurrentPeriodEnd(), now);
            case "PAST_DUE" -> after(subscription.getGracePeriodEndsAt(), now);
            case "CANCELLED" -> after(subscription.getCurrentPeriodEnd(), now);
            default -> false;
        };
    }

    private boolean after(Instant end, Instant now) {
        return end != null && end.isAfter(now);
    }

    private Map<String, Object> stringMap(Object value) {
        if (!(value instanceof Map<?, ?> map)) return Map.of();
        Map<String, Object> result = new LinkedHashMap<>();
        map.forEach((key, item) -> {
            if (key instanceof String stringKey) result.put(stringKey, item);
        });
        return Map.copyOf(result);
    }

    private AccessCheckResponse denied(Evaluation evaluation, String featureKey, String permission) {
        logDenial(evaluation.context(), evaluation.denialCode(), featureKey, permission);
        return new AccessCheckResponse(false, evaluation.denialCode(), evaluation.denialMessage(),
                evaluation.context());
    }

    private void logDenial(AccessContextResponse context, String code, String featureKey, String permission) {
        Metrics.counter("dineflow.authorization.denied", "code", code).increment();
        LOGGER.warn("event=effective_access_denied userId={} restaurantId={} featureKey={} permission={} code={}",
                context.userId(), context.restaurantId(), normalize(featureKey), normalize(permission), code);
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private record NavigationMetadata(String label, String path, String requiredPermission) {}

    private record Evaluation(
            AccessContextResponse context,
            String denialCode,
            String denialMessage) {}
}
