package com.restaurent.business.auth.services;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.restaurent.business.auth.entities.RestaurantTable;
import com.restaurent.business.auth.entities.TableStatus;
import com.restaurent.business.auth.entities.dto.CreateTableRequest;
import com.restaurent.business.auth.entities.dto.UpdateTableRequest;
import com.restaurent.business.auth.repos.RestaurantTableRepository;

import static org.mockito.Mockito.mock;

class RestaurantTableServiceTest {

    private RestaurantTableRepository repository;
    private RestaurantTableService service;

    @BeforeEach
    void setUp() {
        repository = mock(RestaurantTableRepository.class);
        service = new RestaurantTableService(repository);
    }

    @Test
    void createPersistsRestaurantScopeAndAuditIdentity() {
        UUID staffId = UUID.randomUUID();
        when(repository.existsByRestaurantIdAndTableNumber("restaurant-a", 12)).thenReturn(false);
        when(repository.saveAndFlush(any(RestaurantTable.class))).thenAnswer(invocation -> {
            RestaurantTable table = invocation.getArgument(0);
            table.setId(UUID.randomUUID());
            table.setCreatedAt(java.time.Instant.now());
            table.setUpdatedAt(table.getCreatedAt());
            return table;
        });

        var response = service.create("restaurant-a", staffId,
                new CreateTableRequest(12, 4, " Patio ", " Table Twelve "));

        assertEquals("restaurant-a", response.restaurantId());
        assertEquals(12, response.tableNumber());
        assertEquals(4, response.seatingCapacity());
        assertEquals("Patio", response.section());
        assertEquals("Table Twelve", response.displayName());
        assertEquals(TableStatus.ACTIVE, response.status());
        verify(repository).saveAndFlush(any(RestaurantTable.class));
    }

    @Test
    void createRejectsDuplicateNumberWithinRestaurant() {
        when(repository.existsByRestaurantIdAndTableNumber("restaurant-a", 12)).thenReturn(true);

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.create("restaurant-a", UUID.randomUUID(),
                        new CreateTableRequest(12, 4, null, null)));

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        verify(repository, never()).saveAndFlush(any(RestaurantTable.class));
    }

    @Test
    void listOnlyQueriesTheAuthenticatedRestaurant() {
        when(repository.findAllByRestaurantIdOrderByTableNumberAsc("restaurant-a"))
                .thenReturn(List.of());

        service.list("restaurant-a");

        verify(repository).findAllByRestaurantIdOrderByTableNumberAsc("restaurant-a");
    }

    @Test
    void getHidesTablesOwnedByAnotherRestaurant() {
        UUID tableId = UUID.randomUUID();
        when(repository.findByIdAndRestaurantId(tableId, "restaurant-a"))
                .thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> service.get("restaurant-a", tableId));

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
    }

    @Test
    void updateRejectsDuplicateNumberButAllowsKeepingCurrentNumber() {
        UUID tableId = UUID.randomUUID();
        RestaurantTable table = new RestaurantTable();
        table.setId(tableId);
        table.setRestaurantId("restaurant-a");
        table.setTableNumber(12);
        table.setSeatingCapacity(4);
        when(repository.findByIdAndRestaurantId(tableId, "restaurant-a")).thenReturn(Optional.of(table));
        when(repository.existsByRestaurantIdAndTableNumberAndIdNot("restaurant-a", 12, tableId)).thenReturn(false);
        when(repository.saveAndFlush(table)).thenReturn(table);

        var response = service.update("restaurant-a", UUID.randomUUID(), tableId,
                new UpdateTableRequest(12, 6, null, null));

        assertEquals(6, response.seatingCapacity());
    }

    @Test
    void updateStatusChangesOnlyOwnedTable() {
        UUID tableId = UUID.randomUUID();
        RestaurantTable table = new RestaurantTable();
        table.setId(tableId);
        table.setRestaurantId("restaurant-a");
        table.setTableNumber(12);
        table.setSeatingCapacity(4);
        when(repository.findByIdAndRestaurantId(tableId, "restaurant-a")).thenReturn(Optional.of(table));
        when(repository.saveAndFlush(table)).thenReturn(table);

        var response = service.updateStatus("restaurant-a", UUID.randomUUID(), tableId, TableStatus.MAINTENANCE);

        assertEquals(TableStatus.MAINTENANCE, response.status());
    }
}
