CREATE TABLE restaurants (
    id UUID PRIMARY KEY,
    restaurant_id VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE restaurant_registrations (
    id UUID PRIMARY KEY,
    restaurant_name VARCHAR(200) NOT NULL,
    owner_name VARCHAR(200) NOT NULL,
    owner_email VARCHAR(320) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approved_restaurant_id UUID REFERENCES restaurants(id),
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_registration_review_state CHECK (
        (status = 'PENDING' AND reviewed_at IS NULL AND approved_restaurant_id IS NULL)
        OR (status = 'APPROVED' AND reviewed_at IS NOT NULL AND approved_restaurant_id IS NOT NULL)
        OR (status = 'REJECTED' AND reviewed_at IS NOT NULL AND approved_restaurant_id IS NULL)
    )
);

CREATE INDEX idx_restaurant_registrations_status_created
    ON restaurant_registrations (status, created_at);

CREATE TABLE features (
    feature_key VARCHAR(100) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(80) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    limits_supported BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY,
    plan_key VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    custom BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE plan_features (
    id UUID PRIMARY KEY,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
    feature_key VARCHAR(100) NOT NULL REFERENCES features(feature_key),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    limits JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_plan_features_plan_feature UNIQUE (plan_id, feature_key)
);

CREATE TABLE restaurant_subscriptions (
    id UUID PRIMARY KEY,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(24) NOT NULL
        CHECK (status IN ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED', 'SUSPENDED')),
    starts_at TIMESTAMPTZ NOT NULL,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    trial_starts_at TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    grace_period_ends_at TIMESTAMPTZ,
    billing_period VARCHAR(24) NOT NULL DEFAULT 'CUSTOM'
        CHECK (billing_period IN ('MONTHLY', 'ANNUAL', 'CUSTOM')),
    cancelled_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_subscription_period CHECK (
        current_period_end IS NULL OR current_period_start IS NULL
        OR current_period_end > current_period_start
    ),
    CONSTRAINT ck_subscription_trial_period CHECK (
        trial_ends_at IS NULL OR trial_starts_at IS NULL OR trial_ends_at > trial_starts_at
    )
);

CREATE UNIQUE INDEX uk_restaurant_subscription_open
    ON restaurant_subscriptions (restaurant_id)
    WHERE status IN ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'SUSPENDED');
CREATE INDEX idx_restaurant_subscriptions_history
    ON restaurant_subscriptions (restaurant_id, created_at DESC);

CREATE TABLE entitlement_overrides (
    id UUID PRIMARY KEY,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    feature_key VARCHAR(100) NOT NULL REFERENCES features(feature_key),
    enabled BOOLEAN NOT NULL,
    reason TEXT NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMPTZ,
    created_by UUID NOT NULL,
    updated_by UUID,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_entitlement_override_window CHECK (valid_until IS NULL OR valid_until > valid_from)
);
CREATE INDEX idx_entitlement_overrides_restaurant_feature_window
    ON entitlement_overrides (restaurant_id, feature_key, valid_from, valid_until)
    WHERE revoked_at IS NULL;

CREATE TABLE subscription_events (
    id UUID PRIMARY KEY,
    subscription_id UUID NOT NULL REFERENCES restaurant_subscriptions(id),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    event_type VARCHAR(80) NOT NULL,
    from_status VARCHAR(24),
    to_status VARCHAR(24),
    actor_id UUID,
    reason TEXT,
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_subscription_events_subscription_created
    ON subscription_events (subscription_id, created_at DESC);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    restaurant_id UUID REFERENCES restaurants(id),
    actor_id UUID,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(120),
    outcome VARCHAR(24) NOT NULL DEFAULT 'SUCCESS'
        CHECK (outcome IN ('SUCCESS', 'FAILURE', 'DENIED')),
    reason TEXT,
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_logs_restaurant_created
    ON audit_logs (restaurant_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor_created
    ON audit_logs (actor_id, created_at DESC);

CREATE TABLE authorization_versions (
    id UUID PRIMARY KEY,
    scope_type VARCHAR(24) NOT NULL
        CHECK (scope_type IN ('USER', 'RESTAURANT', 'ROLE')),
    scope_key VARCHAR(120) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_authorization_versions_scope UNIQUE (scope_type, scope_key)
);

INSERT INTO features (feature_key, name, description, category) VALUES
    ('MENU_MANAGEMENT', 'Menu management', 'Manage restaurant menu catalogue and availability.', 'OPERATIONS'),
    ('ORDER_MANAGEMENT', 'Order management', 'Create and manage restaurant orders.', 'OPERATIONS'),
    ('TABLE_QR_MANAGEMENT', 'Table and QR management', 'Manage restaurant tables and customer QR sessions.', 'OPERATIONS'),
    ('KITCHEN_DISPLAY', 'Kitchen display', 'View and update kitchen order queues.', 'OPERATIONS'),
    ('WAITER_OPERATIONS', 'Waiter operations', 'Support waiter order and table workflows.', 'OPERATIONS'),
    ('CASHIER_OPERATIONS', 'Cashier operations', 'Support cashier billing and payment workflows.', 'OPERATIONS'),
    ('ANALYTICS', 'Analytics', 'View currently implemented restaurant revenue analytics.', 'REPORTING')
ON CONFLICT (feature_key) DO NOTHING;

DO $$
DECLARE
    source_table TEXT;
BEGIN
    FOREACH source_table IN ARRAY ARRAY['users', 'restaurant_tables', 'table_sessions']
    LOOP
        IF to_regclass('public.' || source_table) IS NOT NULL
           AND EXISTS (
               SELECT 1
               FROM information_schema.columns
               WHERE table_schema = 'public'
                 AND table_name = source_table
                 AND column_name = 'restaurant_id'
           )
        THEN
            EXECUTE format(
                'INSERT INTO restaurants (id, restaurant_id, name, status)
                 SELECT gen_random_uuid(), trim(restaurant_id::text), trim(restaurant_id::text), ''ACTIVE''
                 FROM %I
                 WHERE restaurant_id IS NOT NULL AND trim(restaurant_id::text) <> ''''
                 GROUP BY trim(restaurant_id::text)
                 ON CONFLICT (restaurant_id) DO NOTHING',
                source_table
            );
        END IF;
    END LOOP;
END $$;
