package com.restaurent.business.auth.repos;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import com.restaurent.business.auth.entities.EntitlementOverride;
import com.restaurent.business.auth.entities.Feature;
import com.restaurent.business.auth.entities.Restaurant;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:override-query-tests;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.flyway.enabled=false",
        "platform.subscription.expiry-scan-ms=3600000",
        "jwt.key-dir=target/test-jwt-keys"
})
class EntitlementOverrideRepositoryTest {

    @Autowired
    private EntitlementOverrideRepository overrideRepository;
    @Autowired
    private FeatureRepository featureRepository;
    @Autowired
    private RestaurantRepository restaurantRepository;

    @Test
    void currentOverridesExcludeExpiredAndRevokedAndPrioritizeLatestStart() {
        Restaurant restaurant = new Restaurant();
        restaurant.setRestaurantId("DF-OVERRIDE-QUERY");
        restaurant.setName("Override Query Bistro");
        restaurant = restaurantRepository.saveAndFlush(restaurant);

        Feature feature = new Feature();
        feature.setFeatureKey("OVERRIDE_QUERY_FEATURE");
        feature.setName("Override query");
        feature.setDescription("Test feature");
        feature.setCategory("TEST");
        featureRepository.saveAndFlush(feature);

        Instant now = Instant.now();
        EntitlementOverride oldest = override(restaurant.getId(), feature.getFeatureKey(),
                now.minus(3, ChronoUnit.DAYS), true, null);
        EntitlementOverride newest = override(restaurant.getId(), feature.getFeatureKey(),
                now.minus(1, ChronoUnit.DAYS), false, null);
        EntitlementOverride expired = override(restaurant.getId(), feature.getFeatureKey(),
                now.minus(4, ChronoUnit.DAYS), true, now.minus(2, ChronoUnit.DAYS));
        EntitlementOverride revoked = override(restaurant.getId(), feature.getFeatureKey(),
                now, true, null);
        revoked.setRevokedAt(now);
        overrideRepository.saveAndFlush(oldest);
        overrideRepository.saveAndFlush(newest);
        overrideRepository.saveAndFlush(expired);
        overrideRepository.saveAndFlush(revoked);

        var current = overrideRepository.findCurrentlyValid(
                restaurant.getId(), feature.getFeatureKey(), now);
        assertEquals(2, current.size());
        assertEquals(newest.getId(), current.get(0).getId());
        assertEquals(oldest.getId(), current.get(1).getId());
    }

    private EntitlementOverride override(
            UUID restaurantId, String featureKey, Instant validFrom, boolean enabled, Instant validUntil) {
        EntitlementOverride override = new EntitlementOverride();
        override.setRestaurantId(restaurantId);
        override.setFeatureKey(featureKey);
        override.setEnabled(enabled);
        override.setReason("Repository test");
        override.setValidFrom(validFrom);
        override.setValidUntil(validUntil);
        override.setCreatedBy(UUID.randomUUID());
        return override;
    }
}
