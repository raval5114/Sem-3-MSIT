package com.restaurent.business.auth.repos;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.restaurent.business.auth.entities.RestaurantSubscription;

public interface RestaurantSubscriptionRepository extends JpaRepository<RestaurantSubscription, UUID> {

    List<RestaurantSubscription> findAllByRestaurantIdOrderByCreatedAtDesc(UUID restaurantId);

    boolean existsByRestaurantIdAndTrialStartsAtIsNotNull(UUID restaurantId);

    Page<RestaurantSubscription> findAllByStatusAndTrialEndsAtLessThanEqual(
            String status, Instant now, Pageable pageable);

    Page<RestaurantSubscription> findAllByStatusAndCurrentPeriodEndLessThanEqual(
            String status, Instant now, Pageable pageable);

    Page<RestaurantSubscription> findAllByStatusAndGracePeriodEndsAtLessThanEqual(
            String status, Instant now, Pageable pageable);
}
