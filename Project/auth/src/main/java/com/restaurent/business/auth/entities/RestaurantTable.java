package com.restaurent.business.auth.entities;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "restaurant_tables", uniqueConstraints = {
        @UniqueConstraint(name = "uk_restaurant_table_number", columnNames = {"restaurant_id", "table_number"})
})
public class RestaurantTable {

    @Id
    private UUID id;

    @Column(name = "restaurant_id", nullable = false, length = 100)
    private String restaurantId;

    @Column(name = "table_number", nullable = false)
    private Integer tableNumber;

    @Column(name = "seating_capacity", nullable = false)
    private Integer seatingCapacity;

    @Column(name = "section", length = 80)
    private String section;

    @Column(name = "display_name", length = 100)
    private String displayName;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private TableStatus status = TableStatus.ACTIVE;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @Column(name = "qr_credential_hash", unique = true, length = 64)
    private String qrCredentialHash;

    @Column(name = "qr_credential_version", nullable = false)
    private Integer qrCredentialVersion = 0;

    @Column(name = "qr_issued_at")
    private Instant qrIssuedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void beforeInsert() {
        if (id == null) id = UUID.randomUUID();
        if (status == null) status = TableStatus.ACTIVE;
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void beforeUpdate() {
        updatedAt = Instant.now();
    }
}
