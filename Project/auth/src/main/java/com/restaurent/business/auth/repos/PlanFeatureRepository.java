package com.restaurent.business.auth.repos;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.restaurent.business.auth.entities.PlanFeature;

public interface PlanFeatureRepository extends JpaRepository<PlanFeature, UUID> {

    List<PlanFeature> findAllByPlanId(UUID planId);

    void deleteAllByPlanId(UUID planId);
}
