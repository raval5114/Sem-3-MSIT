package com.restaurent.business.auth.controllers;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.restaurent.business.auth.entities.Role;
import com.restaurent.business.auth.services.RoleService;

@RestController
@RequestMapping("/auth/roles")
@PreAuthorize("hasAuthority('SUPER_ADMIN')") // Secures all endpoints in this controller
public class RoleController {

    @Autowired
    private RoleService roleService;

    @PostMapping
    public Role createRole(@RequestBody Role role) {
        return roleService.createRole(role);
    }

    @GetMapping
    public List<Role> getAllRoles() {
        return roleService.getAllRoles();
    }

    @GetMapping("/{id}")
    public Role getRoleById(@PathVariable int id) {
        return roleService.getRoleById(id)
                .orElseThrow(() -> new RuntimeException("Role not found"));
    }

    @PutMapping("/{id}")
    public Role updateRole(@PathVariable int id, @RequestBody Role role) {
        return roleService.updateRole(id, role);
    }

    @DeleteMapping("/{id}")
    public String deleteRole(@PathVariable int id) {
        roleService.deleteRole(id);
        return "Role deleted successfully";
    }
}
