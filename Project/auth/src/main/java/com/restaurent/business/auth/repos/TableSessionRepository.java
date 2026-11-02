package com.restaurent.business.auth.repos;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.restaurent.business.auth.entities.TableSession;
import com.restaurent.business.auth.entities.TableSessionStatus;

@Repository
public interface TableSessionRepository extends JpaRepository<TableSession, UUID> {

    Optional<TableSession> findFirstByTableIdAndStatusOrderByStartedAtDesc(UUID tableId, TableSessionStatus status);

    Optional<TableSession> findByIdAndRestaurantIdAndStatus(UUID id, String restaurantId, TableSessionStatus status);
}
