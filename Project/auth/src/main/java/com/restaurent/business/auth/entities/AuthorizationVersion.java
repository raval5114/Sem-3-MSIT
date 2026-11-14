package com.restaurent.business.auth.entities;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "authorization_versions", uniqueConstraints = @UniqueConstraint(
        name = "uk_authorization_versions_scope", columnNames = {"scope_type", "scope_key"}))
public class AuthorizationVersion {

    @Id
    private UUID id;

    @Column(name = "scope_type", nullable = false, length = 24)
    private String scopeType;

    @Column(name = "scope_key", nullable = false, length = 120)
    private String scopeKey;

    @Column(nullable = false)
    private long version;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(name = "row_version", nullable = false)
    private long rowVersion;

    @PrePersist
    void beforeInsert() {
        if (id == null) id = UUID.randomUUID();
        updatedAt = Instant.now();
    }

    @PreUpdate
    void beforeUpdate() {
        updatedAt = Instant.now();
    }
}
