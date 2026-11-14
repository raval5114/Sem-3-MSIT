ALTER TABLE restaurant_registrations
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE restaurants
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
