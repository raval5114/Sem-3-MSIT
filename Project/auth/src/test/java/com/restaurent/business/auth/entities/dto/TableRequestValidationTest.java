package com.restaurent.business.auth.entities.dto;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import jakarta.validation.Validation;
import jakarta.validation.Validator;

class TableRequestValidationTest {

    private Validator validator;

    @BeforeEach
    void setUp() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void acceptsValidTableInput() {
        var request = new CreateTableRequest(8, 4, "Patio", "Window Table");

        assertTrue(validator.validate(request).isEmpty());
    }

    @Test
    void rejectsMissingOrNonPositiveNumbers() {
        var missing = new CreateTableRequest(null, null, null, null);
        var nonPositive = new CreateTableRequest(0, -1, null, null);

        assertFalse(validator.validate(missing).isEmpty());
        assertFalse(validator.validate(nonPositive).isEmpty());
    }

    @Test
    void rejectsOptionalTextLongerThanAllowed() {
        var request = new CreateTableRequest(8, 4, "s".repeat(81), "name");
        Set<?> violations = validator.validate(request);

        assertFalse(violations.isEmpty());
    }
}
