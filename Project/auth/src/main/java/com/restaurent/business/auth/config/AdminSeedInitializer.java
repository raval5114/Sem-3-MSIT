package com.restaurent.business.auth.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.restaurent.business.auth.entities.Restaurant;
import com.restaurent.business.auth.entities.Role;
import com.restaurent.business.auth.entities.UserInfo;
import com.restaurent.business.auth.repos.RestaurantRepository;
import com.restaurent.business.auth.repos.RoleRepository;
import com.restaurent.business.auth.repos.UserDetailsRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component
public class AdminSeedInitializer {

    private static final Logger logger = LoggerFactory.getLogger(AdminSeedInitializer.class);
    private static final Set<String> ALLOWED_ROLES =
            Set.of("SUPER_ADMIN", "RESTAURANT_ADMIN", "CHEF", "WAITER", "CASHIER");

    private final Path seedPath;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final UserDetailsRepository userRepository;
    private final RoleRepository roleRepository;
    private final RestaurantRepository restaurantRepository;
    private final PasswordEncoder passwordEncoder;

    public AdminSeedInitializer(
            @Value("${dineflow.admin-seed.path:./admin.seed}") String seedPath,
            UserDetailsRepository userRepository,
            RoleRepository roleRepository,
            RestaurantRepository restaurantRepository,
            PasswordEncoder passwordEncoder) {
        this.seedPath = Path.of(seedPath);
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.restaurantRepository = restaurantRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void seedAccounts() {
        if (!Files.isRegularFile(seedPath)) {
            logger.info("No regular admin seed file found at {}; skipping account seeding", seedPath);
            return;
        }

        AdminSeed seed;
        try {
            seed = objectMapper.readValue(seedPath.toFile(), AdminSeed.class);
        } catch (IOException exception) {
            throw new IllegalStateException("Could not read admin seed file: " + seedPath, exception);
        }

        validate(seed);
        List<SeedAccount> newAccounts = seed.accounts().stream()
                .filter(account -> !userRepository.existsByEmailIgnoreCase(account.email()))
                .toList();
        int skippedCount = seed.accounts().size() - newAccounts.size();

        if (newAccounts.isEmpty()) {
            logger.info("All {} admin seed account(s) already exist; no accounts changed", skippedCount);
            return;
        }

        boolean needsRestaurant = newAccounts.stream().anyMatch(account -> !isSuperAdmin(account.role()));
        String restaurantId = needsRestaurant ? ensureRestaurant(seed.restaurant()) : null;
        Map<String, Role> roles = newAccounts.stream()
                .map(account -> normalizeRole(account.role()))
                .distinct()
                .collect(Collectors.toMap(roleName -> roleName, this::findRole));

        for (SeedAccount account : newAccounts) {
            String roleName = normalizeRole(account.role());
            UserInfo user = UserInfo.builder()
                    .name(account.name().trim())
                    .email(account.email().trim())
                    .password(passwordEncoder.encode(account.password()))
                    .role(roles.get(roleName))
                    .restaurantId(isSuperAdmin(roleName) ? null : restaurantId)
                    .isActive(true)
                    .build();
            userRepository.save(user);
        }

        logger.info("Created {} admin seed account(s); skipped {} existing account(s)",
                newAccounts.size(), skippedCount);
    }

    private void validate(AdminSeed seed) {
        if (seed == null || seed.accounts() == null || seed.accounts().isEmpty()) {
            throw new IllegalStateException("Admin seed file must contain at least one account");
        }

        Set<String> emails = new HashSet<>();
        for (SeedAccount account : seed.accounts()) {
            if (account == null || isBlank(account.name()) || isBlank(account.email())
                    || isBlank(account.password()) || isBlank(account.role())) {
                throw new IllegalStateException("Every admin seed account must include name, email, password, and role");
            }

            String normalizedEmail = account.email().trim().toLowerCase(Locale.ROOT);
            if (!emails.add(normalizedEmail)) {
                throw new IllegalStateException("Admin seed file contains a duplicate email address");
            }
            if (!ALLOWED_ROLES.contains(normalizeRole(account.role()))) {
                throw new IllegalStateException("Admin seed file contains an unsupported account role");
            }
        }

        boolean hasRestaurantAccount = seed.accounts().stream()
                .anyMatch(account -> !isSuperAdmin(account.role()));
        if (hasRestaurantAccount && (seed.restaurant() == null
                || isBlank(seed.restaurant().restaurantId())
                || isBlank(seed.restaurant().name()))) {
            throw new IllegalStateException("Admin seed file must define a restaurant for non-platform accounts");
        }
    }

    private String ensureRestaurant(SeedRestaurant seedRestaurant) {
        return restaurantRepository.findByRestaurantId(seedRestaurant.restaurantId().trim())
                .map(restaurant -> {
                    if (!"ACTIVE".equals(restaurant.getStatus())) {
                        throw new IllegalStateException("Seed restaurant exists but is not active");
                    }
                    return restaurant.getRestaurantId();
                })
                .orElseGet(() -> {
                    Restaurant restaurant = new Restaurant();
                    restaurant.setRestaurantId(seedRestaurant.restaurantId().trim());
                    restaurant.setName(seedRestaurant.name().trim());
                    restaurant.setStatus("ACTIVE");
                    return restaurantRepository.save(restaurant).getRestaurantId();
                });
    }

    private Role findRole(String roleName) {
        return roleRepository.findByName(roleName)
                .orElseThrow(() -> new IllegalStateException("Admin seed role is not initialized: " + roleName));
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String normalizeRole(String role) {
        return role.trim().toUpperCase(Locale.ROOT);
    }

    private boolean isSuperAdmin(String role) {
        return "SUPER_ADMIN".equals(normalizeRole(role));
    }

    public record AdminSeed(SeedRestaurant restaurant, List<SeedAccount> accounts) {
    }

    public record SeedRestaurant(String restaurantId, String name) {
    }

    public record SeedAccount(String name, String email, String password, String role) {
    }
}
