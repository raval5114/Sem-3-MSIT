package com.restaurent.business.auth.services;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.restaurent.business.auth.entities.RestaurantSubscription;
import com.restaurent.business.auth.repos.RestaurantSubscriptionRepository;

@Component
public class SubscriptionExpiryScheduler {

    private final RestaurantSubscriptionRepository subscriptionRepository;
    private final SubscriptionPlatformService subscriptionService;

    public SubscriptionExpiryScheduler(
            RestaurantSubscriptionRepository subscriptionRepository,
            SubscriptionPlatformService subscriptionService) {
        this.subscriptionRepository = subscriptionRepository;
        this.subscriptionService = subscriptionService;
    }

    @Scheduled(fixedDelayString = "${platform.subscription.expiry-scan-ms:60000}")
    public void expireSubscriptions() {
        Instant now = Instant.now();
        processExpired(page -> subscriptionRepository.findAllByStatusAndTrialEndsAtLessThanEqual(
                "TRIALING", now, page), now);
        processExpired(page -> subscriptionRepository.findAllByStatusAndCurrentPeriodEndLessThanEqual(
                "ACTIVE", now, page), now);
        processExpired(page -> subscriptionRepository.findAllByStatusAndCurrentPeriodEndLessThanEqual(
                "CANCELLED", now, page), now);
        processExpired(page -> subscriptionRepository.findAllByStatusAndGracePeriodEndsAtLessThanEqual(
                "PAST_DUE", now, page), now);
    }

    private void processExpired(
            Function<PageRequest, Page<RestaurantSubscription>> query, Instant now) {
        while (true) {
            Page<RestaurantSubscription> batch = query.apply(PageRequest.of(0, 100));
            Set<UUID> ids = new LinkedHashSet<>();
            batch.forEach(subscription -> ids.add(subscription.getId()));
            ids.forEach(id -> subscriptionService.expireIfEligible(id, now));
            if (batch.getNumberOfElements() < batch.getSize()) return;
        }
    }
}
