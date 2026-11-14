package com.restaurent.business.auth.entities.dto;

import com.restaurent.business.auth.entities.Feature;

public record FeatureResponse(
        String featureKey,
        String name,
        String description,
        String category,
        boolean active,
        boolean limitsSupported) {

    public static FeatureResponse from(Feature feature) {
        return new FeatureResponse(feature.getFeatureKey(), feature.getName(), feature.getDescription(),
                feature.getCategory(), feature.isActive(), feature.isLimitsSupported());
    }
}
