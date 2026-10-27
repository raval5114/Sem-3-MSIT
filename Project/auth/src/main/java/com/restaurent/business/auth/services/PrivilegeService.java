package com.restaurent.business.auth.services;

import com.restaurent.business.auth.entities.Privilege;
import com.restaurent.business.auth.repos.PrivilegeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class PrivilegeService {

    @Autowired
    private PrivilegeRepository privilegeRepository;

    public Privilege createPrivilege(Privilege privilege) {
        return privilegeRepository.save(privilege);
    }

    public List<Privilege> getAllPrivileges() {
        return privilegeRepository.findAll();
    }

    public Optional<Privilege> getPrivilegeById(int id) {
        return privilegeRepository.findById(id);
    }

    public Privilege updatePrivilege(int id, Privilege privilegeDetails) {
        return privilegeRepository.findById(id).map(privilege -> {
            privilege.setName(privilegeDetails.getName());
            return privilegeRepository.save(privilege);
        }).orElseThrow(() -> new RuntimeException("Privilege not found with id " + id));
    }

    public void deletePrivilege(int id) {
        privilegeRepository.deleteById(id);
    }
}
