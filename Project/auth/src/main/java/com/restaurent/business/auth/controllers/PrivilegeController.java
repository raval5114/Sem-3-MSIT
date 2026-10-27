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

import com.restaurent.business.auth.entities.Privilege;
import com.restaurent.business.auth.services.PrivilegeService;

@RestController
@RequestMapping("/auth/privileges")
@PreAuthorize("hasAuthority('SUPER_ADMIN')") // Secures all endpoints in this controller
public class PrivilegeController {

    @Autowired
    private PrivilegeService privilegeService;

    @PostMapping
    public Privilege createPrivilege(@RequestBody Privilege privilege) {
        return privilegeService.createPrivilege(privilege);
    }

    @GetMapping
    public List<Privilege> getAllPrivileges() {
        return privilegeService.getAllPrivileges();
    }

    @GetMapping("/{id}")
    public Privilege getPrivilegeById(@PathVariable int id) {
        return privilegeService.getPrivilegeById(id)
                .orElseThrow(() -> new RuntimeException("Privilege not found"));
    }

    @PutMapping("/{id}")
    public Privilege updatePrivilege(@PathVariable int id, @RequestBody Privilege privilege) {
        return privilegeService.updatePrivilege(id, privilege);
    }

    @DeleteMapping("/{id}")
    public String deletePrivilege(@PathVariable int id) {
        privilegeService.deletePrivilege(id);
        return "Privilege deleted successfully";
    }
}
