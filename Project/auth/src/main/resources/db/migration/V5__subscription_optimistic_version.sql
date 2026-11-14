ALTER TABLE restaurant_subscriptions
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
