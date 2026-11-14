package com.restaurent.business.auth.entities;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "restaurant_subscriptions")
public class RestaurantSubscription {

    @Id
    private UUID id;

    @Column(name = "restaurant_id", nullable = false)
    private UUID restaurantId;

    @Column(name = "plan_id", nullable = false)
    private UUID planId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "entitlements_snapshot", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> entitlementsSnapshot = new HashMap<>();

    @Column(nullable = false, length = 24)
    private String status;

    @Column(name = "starts_at", nullable = false)
    private Instant startsAt;

    @Column(name = "current_period_start")
    private Instant currentPeriodStart;

    @Column(name = "current_period_end")
    private Instant currentPeriodEnd;

    @Column(name = "trial_starts_at")
    private Instant trialStartsAt;

    @Column(name = "trial_ends_at")
    private Instant trialEndsAt;

    @Column(name = "grace_period_ends_at")
    private Instant gracePeriodEndsAt;

    @Column(name = "billing_period", nullable = false, length = 24)
    private String billingPeriod = "CUSTOM";

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(nullable = false)
    private long version;

    @PrePersist
    void beforeInsert() {
        if (id == null) id = UUID.randomUUID();
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
        if (entitlementsSnapshot == null) entitlementsSnapshot = new HashMap<>();
    }

    @PreUpdate
    void beforeUpdate() {
        updatedAt = Instant.now();
    }
}
