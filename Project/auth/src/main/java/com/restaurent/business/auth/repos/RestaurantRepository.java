package com.restaurent.business.auth.repos;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.restaurent.business.auth.entities.Restaurant;

public interface RestaurantRepository extends JpaRepository<Restaurant, UUID> {

    Optional<Restaurant> findByRestaurantId(String restaurantId);

    @Query("""
            select r from Restaurant r
            where (:status = '' or r.status = :status)
              and (:query = ''
                   or lower(r.name) like lower(concat('%', :query, '%'))
                   or lower(r.restaurantId) like lower(concat('%', :query, '%')))
            """)
    Page<Restaurant> search(@Param("status") String status,
                            @Param("query") String query,
                            Pageable pageable);
}
