package com.restaurent.business.auth.config;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import com.restaurent.business.auth.entities.Privilege;
import com.restaurent.business.auth.entities.Role;
import com.restaurent.business.auth.repos.PrivilegeRepository;
import com.restaurent.business.auth.repos.RoleRepository;

import jakarta.transaction.Transactional;

@Component
public class RolePrivilegeInitializer implements CommandLineRunner {

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PrivilegeRepository privilegeRepository;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        // 1. Initialize all Privileges specified in project.auth.md
        Privilege menuRead = createPrivilegeIfNotFound("MENU_READ");
        Privilege menuCreate = createPrivilegeIfNotFound("MENU_CREATE");
        Privilege menuUpdate = createPrivilegeIfNotFound("MENU_UPDATE");
        Privilege menuToggleAvail = createPrivilegeIfNotFound("MENU_TOGGLE_AVAIL");

        Privilege orderCreate = createPrivilegeIfNotFound("ORDER_CREATE");
        Privilege orderReadActive = createPrivilegeIfNotFound("ORDER_READ_ACTIVE");
        Privilege orderUpdateStatus = createPrivilegeIfNotFound("ORDER_UPDATE_STATUS");
        Privilege orderCancel = createPrivilegeIfNotFound("ORDER_CANCEL");

        Privilege paymentProcess = createPrivilegeIfNotFound("PAYMENT_PROCESS");
        Privilege paymentRefund = createPrivilegeIfNotFound("PAYMENT_REFUND");

        Privilege tableManage = createPrivilegeIfNotFound("TABLE_MANAGE");
        Privilege staffManage = createPrivilegeIfNotFound("STAFF_MANAGE");

        // 2. Initialize Roles and assign corresponding Privileges
        createRoleIfNotFound("SUPER_ADMIN", new HashSet<>(Arrays.asList(
                menuRead, menuCreate, menuUpdate, paymentRefund, staffManage
        )));

        createRoleIfNotFound("RESTAURANT_ADMIN", new HashSet<>(Arrays.asList(
                menuRead, menuCreate, menuUpdate, menuToggleAvail,
                orderCreate, orderReadActive, orderCancel,
                paymentProcess, paymentRefund,
                tableManage, staffManage
        )));

        createRoleIfNotFound("CHEF", new HashSet<>(Arrays.asList(
                menuRead, menuToggleAvail, orderReadActive, orderUpdateStatus
        )));

        createRoleIfNotFound("WAITER", new HashSet<>(Arrays.asList(
                menuRead, orderCreate, orderReadActive, orderUpdateStatus
        )));

        createRoleIfNotFound("CASHIER", new HashSet<>(Arrays.asList(
                menuRead, orderReadActive, orderCancel, paymentProcess
        )));

        createRoleIfNotFound("CUSTOMER_GUEST", new HashSet<>(Arrays.asList(
                menuRead, orderCreate, paymentProcess
        )));
    }

    private Privilege createPrivilegeIfNotFound(String name) {
        return privilegeRepository.findByName(name).orElseGet(() -> {
            Privilege privilege = new Privilege();
            privilege.setName(name);
            return privilegeRepository.save(privilege);
        });
    }

    private Role createRoleIfNotFound(String name, Set<Privilege> privileges) {
        return roleRepository.findByName(name).map(role -> {
            // Update privileges if role already exists but has different privileges
            role.setPrivileges(privileges);
            return roleRepository.save(role);
        }).orElseGet(() -> {
            Role newRole = new Role();
            newRole.setName(name);
            newRole.setPrivileges(privileges);
            return roleRepository.save(newRole);
        });
    }
}
