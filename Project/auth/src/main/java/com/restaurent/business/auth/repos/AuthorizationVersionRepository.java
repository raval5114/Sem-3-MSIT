package com.restaurent.business.auth.repos;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.restaurent.business.auth.entities.AuthorizationVersion;

public interface AuthorizationVersionRepository extends JpaRepository<AuthorizationVersion, UUID> {

    Optional<AuthorizationVersion> findByScopeTypeAndScopeKey(String scopeType, String scopeKey);
}
