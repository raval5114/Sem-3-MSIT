package com.restaurent.business.auth.repos;

import java.util.Optional;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.restaurent.business.auth.entities.UserInfo;

@Repository
public interface UserDetailsRepository extends JpaRepository<UserInfo, UUID> {

    Optional<UserInfo> findByemail(String email);

    Optional<UserInfo> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    List<UserInfo> findAllByRestaurantIdOrderByNameAsc(String restaurantId);

    Optional<UserInfo> findByIdAndRestaurantId(UUID id, String restaurantId);

    Optional<UserInfo> findByName(String name);
}
