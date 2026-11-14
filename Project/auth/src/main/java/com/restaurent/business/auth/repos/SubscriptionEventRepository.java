package com.restaurent.business.auth.repos;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.restaurent.business.auth.entities.SubscriptionEvent;

public interface SubscriptionEventRepository extends JpaRepository<SubscriptionEvent, UUID> {

    List<SubscriptionEvent> findAllBySubscriptionIdOrderByCreatedAtDesc(UUID subscriptionId);
}
