package com.restaurent.business.auth.repos;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.restaurent.business.auth.entities.UserInfo;

@Repository
public interface UserDetailsRepository extends JpaRepository<UserInfo, UUID> {

    Optional<UserInfo> findByemail(String email);

    Optional<UserInfo> findByName(String name);
}
