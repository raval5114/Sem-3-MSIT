package com.restaurent.business.auth.filters;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import io.micrometer.core.instrument.Metrics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

/** Shared Redis fixed-window limits for public entry points and privileged APIs. */
@Component
public class RequestRateLimitFilter extends OncePerRequestFilter {

    private static final Logger LOGGER = LoggerFactory.getLogger(RequestRateLimitFilter.class);

    private static final DefaultRedisScript<Long> INCREMENT_WINDOW = new DefaultRedisScript<>(
            "local count = redis.call('INCR', KEYS[1]); " +
            "if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); end; " +
            "return count;", Long.class);

    private final StringRedisTemplate redis;

    public RequestRateLimitFilter(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Policy policy = policyFor(request.getMethod(), request.getRequestURI());
        if (policy == null) {
            chain.doFilter(request, response);
            return;
        }

        String identity = identityFor(request, policy);
        String key = "dineflow:rate-limit:" + policy.bucket() + ":" + fingerprint(identity);
        Long count;
        try {
            count = redis.execute(INCREMENT_WINDOW, List.of(key), Long.toString(policy.window().toMillis()));
        } catch (RuntimeException exception) {
            LOGGER.error("event=request_rate_limit_unavailable bucket={} path={}", policy.bucket(), request.getRequestURI());
            Metrics.counter("dineflow.rate_limit.redis_unavailable", "bucket", policy.bucket()).increment();
            response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"success\":false,\"code\":\"RATE_LIMIT_UNAVAILABLE\",\"message\":\"Request protection is temporarily unavailable\"}");
            return;
        }

        if (count == null || count > policy.limit()) {
            Metrics.counter("dineflow.rate_limit.rejected", "bucket", policy.bucket()).increment();
            LOGGER.warn("event=request_rate_limited bucket={} path={} count={} limit={} identityHash={}",
                    policy.bucket(), request.getRequestURI(), count, policy.limit(), fingerprint(identity));
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setHeader("Retry-After", Long.toString(Math.max(1, policy.window().toSeconds())));
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"success\":false,\"code\":\"RATE_LIMITED\",\"message\":\"Too many requests. Try again later.\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    static Policy policyFor(String method, String path) {
        if ("POST".equalsIgnoreCase(method)
                && ("/auth/login".equals(path) || "/auth/generateToken".equals(path))) {
            return new Policy("login", 10, Duration.ofMinutes(1), true);
        }
        if ("POST".equalsIgnoreCase(method) && "/auth/restaurant-registrations".equals(path)) {
            return new Policy("restaurant-registration", 5, Duration.ofHours(1), true);
        }
        if (path.startsWith("/auth/platform/") || path.startsWith("/auth/admin/")
                || path.startsWith("/auth/roles") || path.startsWith("/auth/privileges")
                || ("POST".equalsIgnoreCase(method) && "/auth/addNewUser".equals(path))) {
            return new Policy("privileged", 120, Duration.ofMinutes(1), false);
        }
        return null;
    }

    private String identityFor(HttpServletRequest request, Policy policy) {
        if (!policy.byIp()) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()
                    && authentication.getName() != null && !authentication.getName().isBlank()) {
                return "user:" + authentication.getName();
            }
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && realIp.length() <= 64 && realIp.matches("[0-9A-Fa-f:.]+")) {
            return "ip:" + realIp;
        }
        return "ip:" + request.getRemoteAddr();
    }

    private String fingerprint(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    record Policy(String bucket, long limit, Duration window, boolean byIp) { }
}
