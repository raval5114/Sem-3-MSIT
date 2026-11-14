package com.restaurent.business.auth.services;

import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.restaurent.business.auth.entities.AuthorizationVersion;
import com.restaurent.business.auth.repos.AuthorizationVersionRepository;

@Service
public class AuthorizationVersionService {

    private static final Logger LOGGER = LoggerFactory.getLogger(AuthorizationVersionService.class);
    private static final String CHANNEL = "dineflow:authorization:invalidations";

    private final AuthorizationVersionRepository repository;
    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AuthorizationVersionService(
            AuthorizationVersionRepository repository,
            StringRedisTemplate redis) {
        this.repository = repository;
        this.redis = redis;
    }

    public void invalidate(String scopeType, String scopeKey) {
        AuthorizationVersion version = repository.findByScopeTypeAndScopeKey(scopeType, scopeKey)
                .orElseGet(() -> {
                    AuthorizationVersion created = new AuthorizationVersion();
                    created.setScopeType(scopeType);
                    created.setScopeKey(scopeKey);
                    return created;
                });
        version.setVersion(version.getVersion() + 1);
        AuthorizationVersion saved = repository.saveAndFlush(version);
        Map<String, Object> event = Map.of(
                "scopeType", scopeType,
                "scopeKey", scopeKey,
                "version", saved.getVersion());
        publishAfterCommit(event);
    }

    public Map<String, Long> versions(UUID userId, String restaurantId, Integer roleId) {
        Map<String, Long> result = new java.util.LinkedHashMap<>();
        result.put("USER:" + userId, version("USER", userId.toString()));
        if (restaurantId != null) {
            result.put("RESTAURANT:" + restaurantId, version("RESTAURANT", restaurantId));
        }
        if (roleId != null) {
            result.put("ROLE:" + roleId, version("ROLE", roleId.toString()));
        }
        return result;
    }

    private long version(String scopeType, String scopeKey) {
        return repository.findByScopeTypeAndScopeKey(scopeType, scopeKey)
                .map(AuthorizationVersion::getVersion)
                .orElse(0L);
    }

    private void publishAfterCommit(Map<String, Object> event) {
        Runnable publish = () -> {
            try {
                redis.convertAndSend(CHANNEL, objectMapper.writeValueAsString(event));
            } catch (JsonProcessingException | RuntimeException exception) {
                LOGGER.warn("Authorization invalidation publish failed; online policy checks remain authoritative",
                        exception);
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    publish.run();
                }
            });
        } else {
            publish.run();
        }
    }
}
