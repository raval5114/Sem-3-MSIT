package com.restaurent.business.auth.repos;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.restaurent.business.auth.entities.RestaurantTable;

@Repository
public interface RestaurantTableRepository extends JpaRepository<RestaurantTable, UUID> {

    List<RestaurantTable> findAllByRestaurantIdOrderByTableNumberAsc(String restaurantId);

    Optional<RestaurantTable> findByIdAndRestaurantId(UUID id, String restaurantId);

    Optional<RestaurantTable> findByIdAndRestaurantIdAndQrCredentialHash(UUID id, String restaurantId, String qrCredentialHash);

    Optional<RestaurantTable> findByQrCredentialHash(String qrCredentialHash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from RestaurantTable t where t.id = :id and t.restaurantId = :restaurantId")
    Optional<RestaurantTable> findByIdAndRestaurantIdForUpdate(
            @Param("id") UUID id, @Param("restaurantId") String restaurantId);

    boolean existsByRestaurantIdAndTableNumber(String restaurantId, Integer tableNumber);

    boolean existsByRestaurantIdAndTableNumberAndIdNot(String restaurantId, Integer tableNumber, UUID id);
}
