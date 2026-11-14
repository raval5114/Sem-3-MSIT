package com.restaurent.business.auth.services;

import com.restaurent.business.auth.entities.Role;
import com.restaurent.business.auth.entities.UserInfo;
import com.restaurent.business.auth.entities.dto.UserRequest;
import com.restaurent.business.auth.repos.RestaurantRepository;
import com.restaurent.business.auth.repos.RoleRepository;
import com.restaurent.business.auth.repos.UserDetailsRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class UserInfoService implements UserDetailsService {

    private static final Set<String> PROVISIONABLE_STAFF_ROLES =
            Set.of("RESTAURANT_ADMIN", "WAITER", "CHEF", "CASHIER");

    @Autowired
    private UserDetailsRepository repository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private RestaurantRepository restaurantRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        Optional<UserInfo> userDetail = repository.findByEmailIgnoreCase(username);

        return userDetail.map(this::userDetails)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
    }

    public UserDetails loadUserBySubject(String subject) throws UsernameNotFoundException {
        if (subject != null && subject.startsWith("u_")) {
            try {
                UUID userId = UUID.fromString(subject.substring(2));
                return repository.findById(userId).map(this::userDetails)
                        .orElseThrow(() -> new UsernameNotFoundException("User not found: " + subject));
            } catch (IllegalArgumentException exception) {
                throw new UsernameNotFoundException("Invalid user subject", exception);
            }
        }
        return loadUserByUsername(subject);
    }

    private UserInfoDetails userDetails(UserInfo user) {
        if (!user.isActive()) return new UserInfoDetails(user, false);
        if (user.getRestaurantId() == null || user.getRestaurantId().isBlank()) {
            boolean platformAdmin = user.getRole() != null
                    && "SUPER_ADMIN".equals(user.getRole().getName());
            return new UserInfoDetails(user, platformAdmin);
        }
        boolean restaurantActive = restaurantRepository.findByRestaurantId(user.getRestaurantId())
                .map(restaurant -> "ACTIVE".equals(restaurant.getStatus()))
                .orElse(false);
        return new UserInfoDetails(user, restaurantActive);
    }

    public String addUser(UserRequest userRequest) {
        String roleName = userRequest.getRoleName() == null
                ? "" : userRequest.getRoleName().trim().toUpperCase(Locale.ROOT);
        if ("SUPER_ADMIN".equals(roleName)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Super Admin accounts cannot be created through staff provisioning");
        }
        if (!PROVISIONABLE_STAFF_ROLES.contains(roleName)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported staff role");
        }
        String restaurantId = userRequest.getRestaurantId() == null
                ? "" : userRequest.getRestaurantId().trim();
        if (restaurantId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Restaurant ID is required");
        }
        boolean activeRestaurant = restaurantRepository.findByRestaurantId(restaurantId)
                .map(restaurant -> "ACTIVE".equals(restaurant.getStatus()))
                .orElse(false);
        if (!activeRestaurant) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Active restaurant not found");
        }
        Role userRole = roleRepository.findByName(roleName)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported staff role"));

        UserInfo userInfo = UserInfo.builder()
                .name(userRequest.getName())
                .email(userRequest.getEmail().trim().toLowerCase(Locale.ROOT))
                .password(passwordEncoder.encode(userRequest.getPassword()))
                .role(userRole)
                .restaurantId(restaurantId)
                .isActive(true)
                .build();

        repository.save(userInfo);
        return "User Added Successfully";
    }
}
