package com.restaurent.business.auth.filters;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;

import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.concurrent.atomic.AtomicBoolean;

class RequestRateLimitFilterTest {

    @Test
    void loginAndRegistrationUseSeparateIpPolicies() {
        RequestRateLimitFilter.Policy login = RequestRateLimitFilter.policyFor("POST", "/auth/login");
        RequestRateLimitFilter.Policy registration = RequestRateLimitFilter.policyFor(
                "POST", "/auth/restaurant-registrations");

        assertEquals("login", login.bucket());
        assertEquals(10, login.limit());
        assertEquals(Duration.ofMinutes(1), login.window());
        assertEquals("restaurant-registration", registration.bucket());
        assertEquals(5, registration.limit());
        assertEquals(Duration.ofHours(1), registration.window());
        assertEquals(true, login.byIp());
    }

    @Test
    void privilegedRoutesAreUserScopedAndOtherRoutesAreNotLimitedHere() {
        RequestRateLimitFilter.Policy admin = RequestRateLimitFilter.policyFor(
                "POST", "/auth/platform/restaurants/DF-1/suspend");

        assertEquals("privileged", admin.bucket());
        assertEquals(120, admin.limit());
        assertEquals(false, admin.byIp());
        assertNull(RequestRateLimitFilter.policyFor("GET", "/auth/access/context"));
    }

    @Test
    void redisFailureRejectsProtectedEntryPointAndDoesNotContinueTheChain() throws Exception {
        RequestRateLimitFilter filter = new RequestRateLimitFilter(new StringRedisTemplate());
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/auth/login");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean continued = new AtomicBoolean(false);

        filter.doFilterInternal(request, response, (req, res) -> continued.set(true));

        assertEquals(503, response.getStatus());
        assertTrue(response.getContentAsString().contains("RATE_LIMIT_UNAVAILABLE"));
        assertFalse(continued.get());
    }
}
