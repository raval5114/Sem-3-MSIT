package com.restaurent.business.auth.repos;

import org.springframework.data.jpa.repository.JpaRepository;

import com.restaurent.business.auth.entities.Feature;

public interface FeatureRepository extends JpaRepository<Feature, String> {
}
