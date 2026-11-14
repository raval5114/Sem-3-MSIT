package com.restaurent.business.auth.services;

import com.restaurent.business.auth.entities.Role;
import com.restaurent.business.auth.repos.RoleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class RoleService {

    private final RoleRepository roleRepository;
    private final AuthorizationVersionService authorizationVersionService;

    public RoleService(RoleRepository roleRepository, AuthorizationVersionService authorizationVersionService) {
        this.roleRepository = roleRepository;
        this.authorizationVersionService = authorizationVersionService;
    }

    @Transactional
    public Role createRole(Role role) {
        Role saved = roleRepository.save(role);
        authorizationVersionService.invalidate("ROLE", Integer.toString(saved.getId()));
        return saved;
    }

    public List<Role> getAllRoles() {
        return roleRepository.findAll();
    }

    public Optional<Role> getRoleById(int id) {
        return roleRepository.findById(id);
    }

    @Transactional
    public Role updateRole(int id, Role roleDetails) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Role not found with id " + id));
        role.setName(roleDetails.getName());
        role.setPrivileges(roleDetails.getPrivileges());
        Role saved = roleRepository.save(role);
        authorizationVersionService.invalidate("ROLE", Integer.toString(id));
        return saved;
    }

    @Transactional
    public void deleteRole(int id) {
        roleRepository.deleteById(id);
        authorizationVersionService.invalidate("ROLE", Integer.toString(id));
    }
}
