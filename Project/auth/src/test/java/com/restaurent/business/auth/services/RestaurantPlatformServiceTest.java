package com.restaurent.business.auth.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.restaurent.business.auth.entities.Role;
import com.restaurent.business.auth.entities.UserInfo;
import com.restaurent.business.auth.entities.dto.RegistrationDecisionRequest;
import com.restaurent.business.auth.entities.dto.RestaurantRegistrationRequest;
import com.restaurent.business.auth.repos.AuditLogRepository;
import com.restaurent.business.auth.repos.RestaurantRegistrationRepository;
import com.restaurent.business.auth.repos.RestaurantRepository;
import com.restaurent.business.auth.repos.RoleRepository;
import com.restaurent.business.auth.repos.UserDetailsRepository;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:platform-tests;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.flyway.enabled=false",
        "jwt.key-dir=target/test-jwt-keys"
})
class RestaurantPlatformServiceTest {

    @Autowired
    private RestaurantPlatformService platformService;
    @Autowired
    private RestaurantRegistrationRepository registrationRepository;
    @Autowired
    private RestaurantRepository restaurantRepository;
    @Autowired
    private AuditLogRepository auditLogRepository;
    @Autowired
    private UserDetailsRepository userRepository;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private UserInfoService userInfoService;

    @Test
    void registrationReviewLifecycleAuditsActionsAndBlocksSuspendedStaff() {
        UUID actorId = UUID.randomUUID();
        var application = platformService.submitRegistration(new RestaurantRegistrationRequest(
                "  North  Star Kitchen ", "  Ada Owner ", " OWNER@EXAMPLE.TEST ", " 123 ", " Main Street "));
        assertEquals("PENDING", application.status());
        assertEquals("North Star Kitchen", application.restaurantName());
        assertEquals("owner@example.test", application.ownerEmail());

        ResponseStatusException duplicate = assertThrows(ResponseStatusException.class,
                () -> platformService.submitRegistration(new RestaurantRegistrationRequest(
                        "Another Place", "Another Owner", "owner@example.test", null, null)));
        assertEquals(HttpStatus.CONFLICT, duplicate.getStatusCode());

        var approved = platformService.approve(application.id(), actorId);
        assertEquals("APPROVED", approved.status());
        assertTrue(approved.restaurantId().matches("DF-[A-F0-9]{32}"));
        assertEquals(actorId, approved.reviewedBy());
        assertTrue(restaurantRepository.findByRestaurantId(approved.restaurantId()).isPresent());

        ResponseStatusException reviewedAgain = assertThrows(ResponseStatusException.class,
                () -> platformService.approve(application.id(), actorId));
        assertEquals(HttpStatus.CONFLICT, reviewedAgain.getStatusCode());

        Role restaurantAdmin = roleRepository.findByName("RESTAURANT_ADMIN")
                .orElseGet(() -> roleRepository.save(Role.builder().name("RESTAURANT_ADMIN").build()));
        UserInfo staff = UserInfo.builder()
                .name("Restaurant Admin")
                .email("staff-" + UUID.randomUUID() + "@example.test")
                .password("hashed")
                .role(restaurantAdmin)
                .restaurantId(approved.restaurantId())
                .isActive(true)
                .build();
        staff = userRepository.saveAndFlush(staff);
        assertTrue(((UserInfoDetails) userInfoService.loadUserBySubject("u_" + staff.getId())).isEnabled());

        var suspended = platformService.suspend(
                approved.restaurantId(), actorId, new RegistrationDecisionRequest("Policy review"));
        assertEquals("SUSPENDED", suspended.status());
        assertFalse(((UserInfoDetails) userInfoService.loadUserBySubject("u_" + staff.getId())).isEnabled());
        assertEquals(409, assertThrows(ResponseStatusException.class,
                () -> platformService.suspend(approved.restaurantId(), actorId,
                        new RegistrationDecisionRequest("Duplicate suspension")))
                .getStatusCode().value());

        assertEquals("ACTIVE", platformService.reactivate(approved.restaurantId(), actorId).status());
        assertTrue(((UserInfoDetails) userInfoService.loadUserBySubject("u_" + staff.getId())).isEnabled());
        assertEquals(3, auditLogRepository.countByActorId(actorId));
        assertEquals(1, platformService.listRegistrations("APPROVED", null, PageRequest.of(0, 20)).getTotalElements());
    }

    @Test
    void rejectionRecordsReasonAndReleasesPendingDuplicateMatch() {
        UUID actorId = UUID.randomUUID();
        var application = platformService.submitRegistration(new RestaurantRegistrationRequest(
                "Rejected Bistro", "Owner", "owner@reject.test", null, null));

        var rejected = platformService.reject(
                application.id(), actorId, new RegistrationDecisionRequest("Incomplete application"));

        assertEquals("REJECTED", rejected.status());
        assertEquals("Incomplete application", rejected.rejectionReason());
        assertEquals(actorId, rejected.reviewedBy());
        assertNull(rejected.restaurantId());
        assertEquals(1, auditLogRepository.countByActorId(actorId));
        assertEquals("PENDING", platformService.submitRegistration(new RestaurantRegistrationRequest(
                "Rejected Bistro", "Owner", "owner@reject.test", null, null)).status());
    }
}
