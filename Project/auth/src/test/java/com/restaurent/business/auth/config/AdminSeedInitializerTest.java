package com.restaurent.business.auth.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;

import com.restaurent.business.auth.entities.Restaurant;
import com.restaurent.business.auth.entities.Role;
import com.restaurent.business.auth.entities.UserInfo;
import com.restaurent.business.auth.repos.RestaurantRepository;
import com.restaurent.business.auth.repos.RoleRepository;
import com.restaurent.business.auth.repos.UserDetailsRepository;

import org.springframework.security.crypto.password.PasswordEncoder;

class AdminSeedInitializerTest {

    @TempDir
    Path tempDir;

    private UserDetailsRepository userRepository;
    private RoleRepository roleRepository;
    private RestaurantRepository restaurantRepository;
    private PasswordEncoder passwordEncoder;
    private AdminSeedInitializer initializer;
    private Path seedPath;

    @BeforeEach
    void setUp() {
        seedPath = tempDir.resolve("admin.seed");
        userRepository = org.mockito.Mockito.mock(UserDetailsRepository.class);
        roleRepository = org.mockito.Mockito.mock(RoleRepository.class);
        restaurantRepository = org.mockito.Mockito.mock(RestaurantRepository.class);
        passwordEncoder = org.mockito.Mockito.mock(PasswordEncoder.class);
        initializer = new AdminSeedInitializer(
                seedPath.toString(),
                userRepository,
                roleRepository,
                restaurantRepository,
                passwordEncoder);
    }

    @Test
    void createsMissingAccountsWithEncodedPasswordsAndCorrectTenantScope() throws IOException {
        writeSeed("""
                {
                  "restaurant": {"restaurantId": "rest_123", "name": "Restaurant rest_123"},
                  "accounts": [
                    {"name": "Platform Admin", "email": "platform@example.com", "password": "platform-secret", "role": "SUPER_ADMIN"},
                    {"name": "Restaurant Waiter", "email": "waiter@example.com", "password": "waiter-secret", "role": "WAITER"}
                  ]
                }
                """);
        when(userRepository.existsByEmailIgnoreCase("platform@example.com")).thenReturn(false);
        when(userRepository.existsByEmailIgnoreCase("waiter@example.com")).thenReturn(false);
        when(roleRepository.findByName("SUPER_ADMIN"))
                .thenReturn(Optional.of(Role.builder().name("SUPER_ADMIN").build()));
        when(roleRepository.findByName("WAITER"))
                .thenReturn(Optional.of(Role.builder().name("WAITER").build()));
        when(restaurantRepository.findByRestaurantId("rest_123")).thenReturn(Optional.empty());
        when(restaurantRepository.save(any(Restaurant.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userRepository.save(any(UserInfo.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(passwordEncoder.encode(any(String.class))).thenAnswer(invocation -> "encoded-" + invocation.getArgument(0));

        initializer.seedAccounts();

        ArgumentCaptor<UserInfo> users = ArgumentCaptor.forClass(UserInfo.class);
        verify(userRepository, times(2)).save(users.capture());
        UserInfo superAdmin = users.getAllValues().get(0);
        UserInfo waiter = users.getAllValues().get(1);
        assertNull(superAdmin.getRestaurantId());
        assertEquals("SUPER_ADMIN", superAdmin.getRole().getName());
        assertEquals("encoded-platform-secret", superAdmin.getPassword());
        assertEquals("rest_123", waiter.getRestaurantId());
        assertEquals("WAITER", waiter.getRole().getName());
        assertEquals("encoded-waiter-secret", waiter.getPassword());
    }

    @Test
    void doesNotResetExistingAccountsOnRestart() throws IOException {
        writeSeed("""
                {
                  "accounts": [
                    {"name": "Existing Admin", "email": "admin@example.com", "password": "new-secret", "role": "SUPER_ADMIN"}
                  ]
                }
                """);
        when(userRepository.existsByEmailIgnoreCase("admin@example.com")).thenReturn(true);

        initializer.seedAccounts();

        verify(userRepository, never()).save(any(UserInfo.class));
        verify(passwordEncoder, never()).encode(any(String.class));
        verify(roleRepository, never()).findByName(any(String.class));
    }

    @Test
    void rejectsDuplicateSeedEmailsWithoutCreatingAccounts() throws IOException {
        writeSeed("""
                {
                  "accounts": [
                    {"name": "First", "email": "duplicate@example.com", "password": "first-secret", "role": "SUPER_ADMIN"},
                    {"name": "Second", "email": "DUPLICATE@example.com", "password": "second-secret", "role": "WAITER"}
                  ]
                }
                """);

        assertThrows(IllegalStateException.class, initializer::seedAccounts);

        verify(userRepository, never()).save(any(UserInfo.class));
        verify(restaurantRepository, never()).save(any(Restaurant.class));
    }

    @Test
    void skipsWhenNoSeedFileExists() {
        initializer.seedAccounts();

        verify(userRepository, never()).save(any(UserInfo.class));
    }

    @Test
    void skipsWhenOptionalSeedMountIsADirectory() throws IOException {
        Files.createDirectory(seedPath);

        initializer.seedAccounts();

        verify(userRepository, never()).save(any(UserInfo.class));
    }

    private void writeSeed(String contents) throws IOException {
        Files.writeString(seedPath, contents);
    }
}
