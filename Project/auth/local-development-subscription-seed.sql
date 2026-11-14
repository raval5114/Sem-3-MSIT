-- Local development seed for enabling restaurant staff dashboards.
-- Safe to rerun: skips an existing LOCAL_TEAM_DEV assignment and refuses to replace another open subscription.
BEGIN;

INSERT INTO subscription_plans (id, plan_key, name, description, active, custom)
VALUES (gen_random_uuid(), 'LOCAL_TEAM_DEV', 'Local Team Development', 'Local development plan for enabled DineFlow staff workspaces.', TRUE, TRUE)
ON CONFLICT (plan_key) DO NOTHING;

INSERT INTO plan_features (id, plan_id, feature_key, enabled, limits)
SELECT gen_random_uuid(), plan.id, feature.feature_key, TRUE, '{}'::jsonb
FROM subscription_plans plan
JOIN features feature ON feature.feature_key IN (
    'MENU_MANAGEMENT', 'ORDER_MANAGEMENT', 'TABLE_QR_MANAGEMENT',
    'KITCHEN_DISPLAY', 'WAITER_OPERATIONS', 'CASHIER_OPERATIONS', 'ANALYTICS'
)
WHERE plan.plan_key = 'LOCAL_TEAM_DEV'
ON CONFLICT (plan_id, feature_key)
DO UPDATE SET enabled = EXCLUDED.enabled, limits = EXCLUDED.limits;

DO $$
DECLARE
    target_restaurant restaurants%ROWTYPE;
    target_plan subscription_plans%ROWTYPE;
    existing_subscription restaurant_subscriptions%ROWTYPE;
    assigned_subscription restaurant_subscriptions%ROWTYPE;
    super_admin_id users.id%TYPE;
    required_role TEXT;
    details JSONB;
BEGIN
    SELECT * INTO target_restaurant FROM restaurants WHERE restaurant_id = 'rest_123' FOR UPDATE;
    IF NOT FOUND OR target_restaurant.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Expected active restaurant rest_123 was not found';
    END IF;

    SELECT * INTO target_plan FROM subscription_plans WHERE plan_key = 'LOCAL_TEAM_DEV' AND active = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'LOCAL_TEAM_DEV plan is not active';
    END IF;

    FOREACH required_role IN ARRAY ARRAY['RESTAURANT_ADMIN', 'CASHIER', 'CHEF', 'WAITER'] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM users user_account
            JOIN roles role ON role.id = user_account.role_id
            WHERE user_account.restaurant_id = 'rest_123'
              AND user_account.is_active = TRUE
              AND role.name = required_role
        ) THEN
            RAISE EXCEPTION 'No active % account is assigned to rest_123', required_role;
        END IF;
    END LOOP;

    SELECT * INTO existing_subscription
    FROM restaurant_subscriptions
    WHERE restaurant_id = target_restaurant.id
      AND status IN ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'SUSPENDED')
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        IF existing_subscription.plan_id = target_plan.id AND existing_subscription.status = 'ACTIVE'
           AND existing_subscription.current_period_end > NOW() THEN
            RAISE NOTICE 'rest_123 already has an active LOCAL_TEAM_DEV subscription';
        ELSE
            RAISE EXCEPTION 'rest_123 already has an open subscription; refusing to replace it';
        END IF;
    ELSE
        SELECT id INTO super_admin_id FROM users WHERE lower(email) = 'hariraval@gmail.com';
        SELECT jsonb_object_agg(feature_key, jsonb_build_object('enabled', enabled, 'limits', limits))
        INTO details FROM plan_features WHERE plan_id = target_plan.id;

        INSERT INTO restaurant_subscriptions (
            id, restaurant_id, plan_id, status, starts_at,
            current_period_start, current_period_end, billing_period, entitlements_snapshot
        ) VALUES (
            gen_random_uuid(), target_restaurant.id, target_plan.id, 'ACTIVE', NOW(),
            NOW(), NOW() + INTERVAL '30 days', 'CUSTOM', COALESCE(details, '{}'::jsonb)
        ) RETURNING * INTO assigned_subscription;

        INSERT INTO subscription_events (
            id, subscription_id, restaurant_id, event_type, from_status, to_status,
            actor_id, reason, details
        ) VALUES (
            gen_random_uuid(), assigned_subscription.id, target_restaurant.id,
            'SUBSCRIPTION_ASSIGNED', NULL, 'ACTIVE', super_admin_id,
            'Local development seed for role dashboard access',
            jsonb_build_object('planKey', target_plan.plan_key, 'source', 'local-development-seed')
        );

        INSERT INTO audit_logs (
            id, restaurant_id, actor_id, action, resource_type, resource_id,
            outcome, reason, details
        ) VALUES (
            gen_random_uuid(), target_restaurant.id, super_admin_id,
            'SUBSCRIPTION_ASSIGNED', 'SUBSCRIPTION', assigned_subscription.id::text,
            'SUCCESS', 'Local development seed for role dashboard access',
            jsonb_build_object('planKey', target_plan.plan_key, 'source', 'local-development-seed')
        );

        INSERT INTO authorization_versions (id, scope_type, scope_key, version)
        VALUES (gen_random_uuid(), 'RESTAURANT', target_restaurant.restaurant_id, 1)
        ON CONFLICT (scope_type, scope_key)
        DO UPDATE SET version = authorization_versions.version + 1, updated_at = NOW();
    END IF;
END $$;

COMMIT;
