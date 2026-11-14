package com.restaurent.business.auth.services;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;

import com.restaurent.business.auth.entities.AuthorizationVersion;
import com.restaurent.business.auth.repos.AuthorizationVersionRepository;

@ExtendWith(MockitoExtension.class)
class AuthorizationVersionServiceTest {

    @Mock private AuthorizationVersionRepository repository;
    @Mock private StringRedisTemplate redis;

    private AuthorizationVersionService service;

    @BeforeEach
    void setUp() {
        service = new AuthorizationVersionService(repository, redis);
    }

    @Test
    void incrementsDatabaseVersionAndPublishesInvalidation() {
        when(repository.findByScopeTypeAndScopeKey("FEATURE", "MENU_MANAGEMENT"))
                .thenReturn(Optional.empty());
        when(repository.saveAndFlush(any(AuthorizationVersion.class))).thenAnswer(call -> call.getArgument(0));

        service.invalidate("FEATURE", "MENU_MANAGEMENT");

        ArgumentCaptor<AuthorizationVersion> saved = ArgumentCaptor.forClass(AuthorizationVersion.class);
        verify(repository).saveAndFlush(saved.capture());
        assertEquals("FEATURE", saved.getValue().getScopeType());
        assertEquals("MENU_MANAGEMENT", saved.getValue().getScopeKey());
        assertEquals(1, saved.getValue().getVersion());
        ArgumentCaptor<String> event = ArgumentCaptor.forClass(String.class);
        verify(redis).convertAndSend(eq("dineflow:authorization:invalidations"), event.capture());
        assertTrue(event.getValue().contains("\"scopeType\":\"FEATURE\""));
        assertTrue(event.getValue().contains("\"scopeKey\":\"MENU_MANAGEMENT\""));
        assertTrue(event.getValue().contains("\"version\":1"));
    }

    @Test
    void redisFailureDoesNotUndoTheAuthoritativeDatabaseVersion() {
        when(repository.findByScopeTypeAndScopeKey("ROLE", "2")).thenReturn(Optional.empty());
        when(repository.saveAndFlush(any(AuthorizationVersion.class))).thenAnswer(call -> call.getArgument(0));
        doThrow(new RedisConnectionFailureException("offline"))
                .when(redis).convertAndSend(eq("dineflow:authorization:invalidations"), any(String.class));

        assertDoesNotThrow(() -> service.invalidate("ROLE", "2"));
    }
}
