package com.restaurent.business.auth.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import com.restaurent.business.auth.entities.dto.UserRequest;
import com.restaurent.business.auth.repos.RoleRepository;
import com.restaurent.business.auth.repos.UserDetailsRepository;

import static org.mockito.Mockito.mock;

class UserInfoServiceRegistrationTest {

    @Test
    void publicStaffRegistrationCannotCreateSuperAdmin() {
        UserInfoService service = new UserInfoService();
        ReflectionTestUtils.setField(service, "repository", mock(UserDetailsRepository.class));
        ReflectionTestUtils.setField(service, "roleRepository", mock(RoleRepository.class));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.addUser(new UserRequest(
                        "Platform Admin", "platform@example.test", "password",
                        "SUPER_ADMIN", null)));

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
    }

    @Test
    void staffRegistrationRejectsRolesThatCouldGrantPlatformOrCustomerIdentity() {
        UserInfoService service = new UserInfoService();
        ReflectionTestUtils.setField(service, "repository", mock(UserDetailsRepository.class));
        ReflectionTestUtils.setField(service, "roleRepository", mock(RoleRepository.class));

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.addUser(new UserRequest(
                        "Guest", "guest@example.test", "long-secure-password",
                        "CUSTOMER_GUEST", "DF-test")));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
    }
}
