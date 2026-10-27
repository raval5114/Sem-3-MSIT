package com.restaurent.business.auth.services;

import com.restaurent.business.auth.entities.Role;
import com.restaurent.business.auth.repos.RoleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class RoleService {

    @Autowired
    private RoleRepository roleRepository;

    public Role createRole(Role role) {
        return roleRepository.save(role);
    }

    public List<Role> getAllRoles() {
        return roleRepository.findAll();
    }

    public Optional<Role> getRoleById(int id) {
        return roleRepository.findById(id);
    }

    public Role updateRole(int id, Role roleDetails) {
        return roleRepository.findById(id).map(role -> {
            role.setName(roleDetails.getName());
            role.setPrivileges(roleDetails.getPrivileges());
            return roleRepository.save(role);
        }).orElseThrow(() -> new RuntimeException("Role not found with id " + id));
    }

    public void deleteRole(int id) {
        roleRepository.deleteById(id);
    }
}
