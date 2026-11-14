package com.restaurent.business.auth.repos;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import com.restaurent.business.auth.entities.Feature;
import com.restaurent.business.auth.entities.Restaurant;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:subscription-tests;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.flyway.enabled=false",
        "jwt.key-dir=target/test-jwt-keys"
})
class SubscriptionFoundationRepositoryTest {

    @Autowired
    private FeatureRepository featureRepository;

    @Autowired
    private RestaurantRepository restaurantRepository;

    @Test
    void foundationEntitiesPersistWithStableFeatureKeysAndRestaurantIds() {
        Feature feature = new Feature();
        feature.setFeatureKey("MENU_MANAGEMENT");
        feature.setName("Menu management");
        feature.setDescription("Manage restaurant menus.");
        feature.setCategory("OPERATIONS");
        featureRepository.saveAndFlush(feature);

        Restaurant restaurant = new Restaurant();
        restaurant.setRestaurantId("restaurant-test");
        restaurant.setName("Test Restaurant");
        restaurantRepository.saveAndFlush(restaurant);

        assertTrue(featureRepository.findById("MENU_MANAGEMENT").isPresent());
        assertEquals(1, restaurantRepository.count());
        assertTrue(restaurantRepository.findByRestaurantId("restaurant-test").isPresent());
    }
}
