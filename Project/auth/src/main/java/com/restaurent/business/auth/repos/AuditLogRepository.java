package com.restaurent.business.auth.repos;

import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.restaurent.business.auth.entities.AuditLog;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    long countByActorId(UUID actorId);

    @Query("""
            select a from AuditLog a
            where (:restaurantId is null or a.restaurantId = :restaurantId)
              and (:resourceType is null or a.resourceType = :resourceType)
            """)
    Page<AuditLog> search(@Param("restaurantId") UUID restaurantId,
                          @Param("resourceType") String resourceType,
                          Pageable pageable);
}
