package com.restaurent.business.auth.repos;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.restaurent.business.auth.entities.Privilege;

@Repository
public interface PrivilegeRepository extends JpaRepository<Privilege, Integer> {

    Optional<Privilege> findByName(String name);
}
