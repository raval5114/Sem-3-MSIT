package com.restaurent.business.auth.repos;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;

import com.restaurent.business.auth.entities.RestaurantTable;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:table-tests;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "jwt.key-dir=target/test-jwt-keys"
})
class RestaurantTableRepositoryTest {

    @Autowired
    private RestaurantTableRepository repository;

    @Test
    void tableNumberIsUniquePerRestaurantButMayRepeatAcrossRestaurants() {
        repository.saveAndFlush(table("restaurant-a", 4));
        repository.saveAndFlush(table("restaurant-b", 4));

        assertEquals(2, repository.count());
        assertThrows(DataIntegrityViolationException.class,
                () -> repository.saveAndFlush(table("restaurant-a", 4)));
    }

    private RestaurantTable table(String restaurantId, int number) {
        RestaurantTable table = new RestaurantTable();
        table.setRestaurantId(restaurantId);
        table.setTableNumber(number);
        table.setSeatingCapacity(4);
        return table;
    }
}
