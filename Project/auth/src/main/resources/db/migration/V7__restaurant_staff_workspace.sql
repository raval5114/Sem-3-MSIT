ALTER TABLE restaurants
    ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(32),
    ADD COLUMN IF NOT EXISTS address VARCHAR(2000);

ALTER TABLE restaurant_tables
    ADD COLUMN IF NOT EXISTS assigned_waiter_id UUID;

CREATE INDEX IF NOT EXISTS idx_restaurant_tables_assigned_waiter
    ON restaurant_tables (restaurant_id, assigned_waiter_id);
