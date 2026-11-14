package com.restaurent.business.auth.repos;

import java.util.List;
import java.util.UUID;
import java.time.Instant;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.restaurent.business.auth.entities.EntitlementOverride;

public interface EntitlementOverrideRepository extends JpaRepository<EntitlementOverride, UUID> {

    List<EntitlementOverride> findAllByRestaurantIdAndFeatureKeyOrderByValidFromDesc(
            UUID restaurantId, String featureKey);

    List<EntitlementOverride> findAllByRestaurantIdOrderByCreatedAtDesc(UUID restaurantId);

    @Query("""
            select o from EntitlementOverride o
            where o.restaurantId = :restaurantId
              and o.featureKey = :featureKey
              and o.revokedAt is null
              and o.validFrom <= :now
              and (o.validUntil is null or o.validUntil > :now)
            order by o.validFrom desc, o.createdAt desc
            """)
    List<EntitlementOverride> findCurrentlyValid(
            @Param("restaurantId") UUID restaurantId,
            @Param("featureKey") String featureKey,
            @Param("now") Instant now);
}
