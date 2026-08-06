package com.restaurent.business.auth.repos;

import com.restaurent.business.auth.entities.UserInfo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserDetailsRepository extends JpaRepository<UserInfo, Integer> {
    Optional<UserInfo> findByemail(String email);
    Optional<UserInfo> findByName(String name); // Just in case, as secondary
}
