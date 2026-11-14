package com.restaurent.business.auth.services;

import java.util.List;
import java.util.UUID;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.restaurent.business.auth.entities.RestaurantTable;
import com.restaurent.business.auth.entities.TableStatus;
import com.restaurent.business.auth.entities.UserInfo;
import com.restaurent.business.auth.entities.dto.CreateTableRequest;
import com.restaurent.business.auth.entities.dto.TableResponse;
import com.restaurent.business.auth.entities.dto.UpdateTableRequest;
import com.restaurent.business.auth.repos.RestaurantTableRepository;
import com.restaurent.business.auth.repos.UserDetailsRepository;

@Service
public class RestaurantTableService {

    private final RestaurantTableRepository tableRepository;
    private final UserDetailsRepository userRepository;

    public RestaurantTableService(
            RestaurantTableRepository tableRepository,
            UserDetailsRepository userRepository) {
        this.tableRepository = tableRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public TableResponse create(String restaurantId, UUID staffId, CreateTableRequest request) {
        requireRestaurant(restaurantId);
        if (tableRepository.existsByRestaurantIdAndTableNumber(restaurantId, request.tableNumber())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Table number already exists in this restaurant");
        }

        RestaurantTable table = new RestaurantTable();
        table.setRestaurantId(restaurantId);
        table.setTableNumber(request.tableNumber());
        table.setSeatingCapacity(request.seatingCapacity());
        table.setSection(clean(request.section()));
        table.setDisplayName(clean(request.displayName()));
        table.setStatus(TableStatus.ACTIVE);
        table.setCreatedBy(staffId);
        table.setUpdatedBy(staffId);
        return save(table);
    }

    @Transactional(readOnly = true)
    public List<TableResponse> list(String restaurantId) {
        requireRestaurant(restaurantId);
        return tableRepository.findAllByRestaurantIdOrderByTableNumberAsc(restaurantId)
                .stream().map(TableResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public TableResponse get(String restaurantId, UUID tableId) {
        return TableResponse.from(findOwnedTable(restaurantId, tableId));
    }

    @Transactional
    public TableResponse update(String restaurantId, UUID staffId, UUID tableId, UpdateTableRequest request) {
        RestaurantTable table = findOwnedTable(restaurantId, tableId);
        if (tableRepository.existsByRestaurantIdAndTableNumberAndIdNot(
                restaurantId, request.tableNumber(), tableId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Table number already exists in this restaurant");
        }
        table.setTableNumber(request.tableNumber());
        table.setSeatingCapacity(request.seatingCapacity());
        table.setSection(clean(request.section()));
        table.setDisplayName(clean(request.displayName()));
        table.setUpdatedBy(staffId);
        return save(table);
    }

    @Transactional
    public TableResponse updateStatus(String restaurantId, UUID staffId, UUID tableId, TableStatus status) {
        RestaurantTable table = findOwnedTable(restaurantId, tableId);
        table.setStatus(status);
        table.setUpdatedBy(staffId);
        return save(table);
    }

    @Transactional
    public TableResponse assignWaiter(String restaurantId, UUID staffId, UUID tableId, UUID waiterId) {
        RestaurantTable table = findOwnedTable(restaurantId, tableId);
        if (waiterId != null) {
            UserInfo waiter = userRepository.findByIdAndRestaurantId(waiterId, restaurantId)
                    .filter(UserInfo::isActive)
                    .filter(user -> user.getRole() != null && "WAITER".equals(user.getRole().getName()))
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.BAD_REQUEST, "An active waiter from this restaurant is required"));
            table.setAssignedWaiterId(waiter.getId());
        } else {
            table.setAssignedWaiterId(null);
        }
        table.setUpdatedBy(staffId);
        return save(table);
    }

    @Transactional(readOnly = true)
    public List<TableResponse> assignedToWaiter(String restaurantId, UUID waiterId) {
        requireRestaurant(restaurantId);
        return tableRepository.findAllByRestaurantIdAndAssignedWaiterIdOrderByTableNumberAsc(restaurantId, waiterId)
                .stream()
                .filter(table -> table.getStatus() == TableStatus.ACTIVE)
                .map(TableResponse::from)
                .toList();
    }

    private TableResponse save(RestaurantTable table) {
        try {
            return TableResponse.from(tableRepository.saveAndFlush(table));
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Table number already exists in this restaurant", exception);
        }
    }

    private RestaurantTable findOwnedTable(String restaurantId, UUID tableId) {
        requireRestaurant(restaurantId);
        return tableRepository.findByIdAndRestaurantId(tableId, restaurantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Table not found"));
    }

    private void requireRestaurant(String restaurantId) {
        if (restaurantId == null || restaurantId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff account is not assigned to a restaurant");
        }
    }

    private String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
