ALTER TABLE restaurant_subscriptions
    ADD COLUMN entitlements_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB;

UPDATE restaurant_subscriptions subscription
SET entitlements_snapshot = COALESCE((
    SELECT jsonb_object_agg(
        plan_feature.feature_key,
        jsonb_build_object(
            'enabled', plan_feature.enabled,
            'limits', plan_feature.limits
        )
    )
    FROM plan_features plan_feature
    WHERE plan_feature.plan_id = subscription.plan_id
), '{}'::JSONB);
