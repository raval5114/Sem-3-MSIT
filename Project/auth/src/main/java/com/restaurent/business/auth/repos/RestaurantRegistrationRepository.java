package com.restaurent.business.auth.repos;

import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.restaurent.business.auth.entities.RestaurantRegistration;

public interface RestaurantRegistrationRepository extends JpaRepository<RestaurantRegistration, UUID> {

    @Query("""
            select count(r) > 0 from RestaurantRegistration r
            where r.status = 'PENDING'
              and (lower(r.ownerEmail) = lower(:ownerEmail)
                   or lower(r.restaurantName) = lower(:restaurantName))
            """)
    boolean existsPendingDuplicate(@Param("ownerEmail") String ownerEmail,
                                   @Param("restaurantName") String restaurantName);

    @Query("""
            select r from RestaurantRegistration r
            where (:status = '' or r.status = :status)
              and (:query = ''
                   or lower(r.restaurantName) like lower(concat('%', :query, '%'))
                   or lower(r.ownerName) like lower(concat('%', :query, '%'))
                   or lower(r.ownerEmail) like lower(concat('%', :query, '%')))
            """)
    Page<RestaurantRegistration> search(@Param("status") String status,
                                        @Param("query") String query,
                                        Pageable pageable);
}
