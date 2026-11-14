import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  authService,
  type FeatureDefinition,
  type PlatformRestaurant,
  type RestaurantEntitlementOverride,
  type RestaurantSubscription,
  type SubscriptionPlan,
} from '../services/authService';

type PlanFeatureDraft = { featureKey: string; enabled: boolean; limitsText: string };

function messageFrom(cause: unknown): string {
  const error = cause as { response?: { data?: { message?: string; detail?: string } }; message?: string };
  return error.response?.data?.message ?? error.response?.data?.detail ?? error.message ?? 'The request could not be completed.';
}

function localDateToIso(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Feature limits must be a JSON object.');
  }
  return value as Record<string, unknown>;
}

export default function SubscriptionManagementPanel() {
  const [restaurants, setRestaurants] = useState<PlatformRestaurant[]>([]);
  const [features, setFeatures] = useState<FeatureDefinition[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<RestaurantSubscription[]>([]);
  const [overrides, setOverrides] = useState<RestaurantEntitlementOverride[]>([]);
  const [restaurantId, setRestaurantId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [editingPlanId, setEditingPlanId] = useState('');
  const [planKey, setPlanKey] = useState('');
  const [planName, setPlanName] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [planActive, setPlanActive] = useState(true);
  const [customPlan, setCustomPlan] = useState(false);
  const [planFeatures, setPlanFeatures] = useState<PlanFeatureDraft[]>([]);

  const [editingFeatureKey, setEditingFeatureKey] = useState('');
  const [featureKey, setFeatureKey] = useState('');
  const [featureName, setFeatureName] = useState('');
  const [featureDescription, setFeatureDescription] = useState('');
  const [featureCategory, setFeatureCategory] = useState('');
  const [featureActive, setFeatureActive] = useState(true);
  const [limitsSupported, setLimitsSupported] = useState(false);

  const [subscriptionStatus, setSubscriptionStatus] = useState<'TRIALING' | 'ACTIVE'>('TRIALING');
  const [billingPeriod, setBillingPeriod] = useState<'MONTHLY' | 'ANNUAL' | 'CUSTOM'>('MONTHLY');
  const [customPeriodEnd, setCustomPeriodEnd] = useState('');
  const [overrideFeature, setOverrideFeature] = useState('');
  const [overrideEnabled, setOverrideEnabled] = useState(true);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideFrom, setOverrideFrom] = useState('');
  const [overrideUntil, setOverrideUntil] = useState('');

  const loadBase = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [restaurantPage, featureRows, planRows] = await Promise.all([
        authService.platform.listRestaurants({ page: 0, size: 100 }),
        authService.platform.listFeatures(),
        authService.platform.listPlans(),
      ]);
      const laterPages = await Promise.all(
        Array.from({ length: Math.max(restaurantPage.totalPages - 1, 0) }, (_, index) =>
          authService.platform.listRestaurants({ page: index + 1, size: 100 })),
      );
      const activeRestaurants = [restaurantPage, ...laterPages]
        .flatMap((page) => page.content)
        .filter((item) => item.status === 'ACTIVE');
      setRestaurants(activeRestaurants);
      setFeatures(featureRows);
      setPlans(planRows);
      setPlanFeatures(featureRows.map((feature) => ({ featureKey: feature.featureKey, enabled: false, limitsText: '{}' })));
      setRestaurantId((current) => current || activeRestaurants[0]?.restaurantId || '');
      setSelectedPlanId((current) => current || planRows.find((plan) => plan.active)?.id || '');
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRestaurantData = useCallback(async () => {
    if (!restaurantId) {
      setSubscriptions([]);
      setOverrides([]);
      return;
    }
    try {
      const [subscriptionRows, overrideRows] = await Promise.all([
        authService.platform.listSubscriptions(restaurantId),
        authService.platform.listOverrides(restaurantId),
      ]);
      setSubscriptions(subscriptionRows);
      setOverrides(overrideRows);
    } catch (cause) {
      setError(messageFrom(cause));
    }
  }, [restaurantId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadBase(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBase]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRestaurantData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRestaurantData]);

  const finishAction = async (action: () => Promise<unknown>, success: string): Promise<boolean> => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(success);
      await loadBase();
      await loadRestaurantData();
      return true;
    } catch (cause) {
      setError(messageFrom(cause));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const resetPlanForm = () => {
    setEditingPlanId('');
    setPlanKey('');
    setPlanName('');
    setPlanDescription('');
    setPlanActive(true);
    setCustomPlan(false);
    setPlanFeatures(features.map((feature) => ({ featureKey: feature.featureKey, enabled: false, limitsText: '{}' })));
  };

  const editPlan = (plan: SubscriptionPlan) => {
    setEditingPlanId(plan.id);
    setPlanKey(plan.planKey);
    setPlanName(plan.name);
    setPlanDescription(plan.description ?? '');
    setPlanActive(plan.active);
    setCustomPlan(plan.customPlan);
    const mapping = new Map(plan.features.map((feature) => [feature.featureKey, feature]));
    setPlanFeatures(features.map((feature) => {
      const current = mapping.get(feature.featureKey);
      return { featureKey: feature.featureKey, enabled: current?.enabled ?? false, limitsText: JSON.stringify(current?.limits ?? {}, null, 2) };
    }));
  };

  const savePlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const mappings = planFeatures.map((feature) => ({
        featureKey: feature.featureKey,
        enabled: feature.enabled,
        limits: asObject(JSON.parse(feature.limitsText || '{}')),
      }));
      const payload = {
        planKey: planKey.trim(),
        name: planName.trim(),
        description: planDescription.trim() || null,
        active: planActive,
        customPlan,
        features: mappings,
      };
      const saved = await finishAction(() => editingPlanId
        ? authService.platform.updatePlan(editingPlanId, payload)
        : authService.platform.createPlan(payload), editingPlanId ? 'Plan updated.' : 'Plan created.');
      if (saved) resetPlanForm();
    } catch (cause) {
      setError(messageFrom(cause));
    }
  };

  const editFeature = (feature: FeatureDefinition) => {
    setEditingFeatureKey(feature.featureKey);
    setFeatureKey(feature.featureKey);
    setFeatureName(feature.name);
    setFeatureDescription(feature.description);
    setFeatureCategory(feature.category);
    setFeatureActive(feature.active);
    setLimitsSupported(feature.limitsSupported);
  };

  const saveFeature = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: FeatureDefinition = {
      featureKey: featureKey.trim().toUpperCase(),
      name: featureName.trim(),
      description: featureDescription.trim(),
      category: featureCategory.trim(),
      active: featureActive,
      limitsSupported,
    };
    const saved = await finishAction(() => editingFeatureKey
      ? authService.platform.updateFeature(editingFeatureKey, payload)
      : authService.platform.createFeature(payload), editingFeatureKey ? 'Feature updated.' : 'Feature added.');
    if (!saved) return;
    setEditingFeatureKey('');
    setFeatureKey('');
    setFeatureName('');
    setFeatureDescription('');
    setFeatureCategory('');
    setFeatureActive(true);
    setLimitsSupported(false);
  };

  const assignSubscription = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!restaurantId || !selectedPlanId) return;
    const periodEnd = subscriptionStatus === 'ACTIVE' && billingPeriod === 'CUSTOM'
      ? localDateToIso(customPeriodEnd) : undefined;
    if (subscriptionStatus === 'ACTIVE' && billingPeriod === 'CUSTOM' && !periodEnd) {
      setError('Choose a paid-through date for a custom billing period.');
      return;
    }
    await finishAction(() => authService.platform.assignSubscription(restaurantId, {
      planId: selectedPlanId,
      status: subscriptionStatus,
      billingPeriod,
      currentPeriodEnd: periodEnd,
      reason: subscriptionStatus === 'TRIALING' ? 'Initial 14-day trial' : 'Super Admin assignment',
    }), 'Subscription assigned.');
  };

  const transitionSubscription = (subscription: RestaurantSubscription, target: RestaurantSubscription['status']) => {
    const reason = window.prompt(`Reason for changing subscription to ${target}?`);
    if (!reason?.trim()) return;
    let periodEnd: string | undefined;
    if (target === 'ACTIVE' && subscription.billingPeriod === 'CUSTOM') {
      periodEnd = window.prompt('Enter the new paid-through date and time in ISO 8601 format (for example 2026-12-03T00:00:00Z)') || undefined;
      if (!periodEnd || Number.isNaN(Date.parse(periodEnd))) return;
    }
    void finishAction(() => authService.platform.transitionSubscription(subscription.id, {
      status: target,
      reason: reason.trim(),
      currentPeriodEnd: periodEnd,
    }), `Subscription changed to ${target}.`);
  };

  const createOverride = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!restaurantId) return;
    const saved = await finishAction(() => authService.platform.createOverride(restaurantId, {
      featureKey: overrideFeature,
      enabled: overrideEnabled,
      reason: overrideReason.trim(),
      validFrom: localDateToIso(overrideFrom),
      validUntil: localDateToIso(overrideUntil),
    }), 'Feature override saved.');
    if (!saved) return;
    setOverrideReason('');
    setOverrideFrom('');
    setOverrideUntil('');
  };

  const revokeOverride = (override: RestaurantEntitlementOverride) => {
    const reason = window.prompt(`Reason for revoking the ${override.featureKey} override?`);
    if (!reason?.trim()) return;
    void finishAction(() => authService.platform.revokeOverride(override.id, reason.trim()), 'Feature override revoked.');
  };

  if (loading) return <div className="df-platform-empty" role="status">Loading plans and subscriptions…</div>;

  return (
    <div className="df-subscription-workspace">
      {error && <div className="df-platform-alert error" role="alert"><span>{error}</span><button onClick={() => { void loadBase(); void loadRestaurantData(); }}>Retry</button></div>}
      {notice && <div className="df-platform-alert success" role="status">{notice}</div>}

      <section className="df-platform-panel">
        <div className="df-platform-panel-header"><div><h2>Feature catalogue</h2><p>Stable feature keys are permanent; deactivate features instead of removing them.</p></div></div>
        <div className="df-subscription-content">
          <div className="df-subscription-feature-list">
            {features.map((feature) => <div className="df-subscription-feature" key={feature.featureKey}>
              <div><strong>{feature.name}</strong><small>{feature.featureKey} · {feature.category} · {feature.active ? 'Active' : 'Inactive'}</small><small>{feature.description}</small></div>
              <button type="button" className="df-platform-table-action" disabled={busy} onClick={() => editFeature(feature)}>Edit</button>
            </div>)}
            {!features.length && <div className="df-platform-empty">No feature catalogue entries exist.</div>}
          </div>
          <form className="df-subscription-form" onSubmit={(event) => { void saveFeature(event); }}>
            <h3>{editingFeatureKey ? `Edit ${editingFeatureKey}` : 'Add feature'}</h3>
            <label>Stable key<input required maxLength={100} disabled={Boolean(editingFeatureKey)} value={featureKey} onChange={(event) => setFeatureKey(event.target.value)} placeholder="INVENTORY_MANAGEMENT" /></label>
            <label>Name<input required maxLength={150} value={featureName} onChange={(event) => setFeatureName(event.target.value)} /></label>
            <label>Description<textarea required maxLength={4000} value={featureDescription} onChange={(event) => setFeatureDescription(event.target.value)} /></label>
            <label>Category<input required maxLength={80} value={featureCategory} onChange={(event) => setFeatureCategory(event.target.value)} /></label>
            <label className="df-subscription-check"><input type="checkbox" checked={featureActive} onChange={(event) => setFeatureActive(event.target.checked)} /> Active for new plans</label>
            <label className="df-subscription-check"><input type="checkbox" checked={limitsSupported} onChange={(event) => setLimitsSupported(event.target.checked)} /> Supports quotas/limits</label>
            <div className="df-subscription-actions"><button disabled={busy}>{editingFeatureKey ? 'Save feature' : 'Add feature'}</button>{editingFeatureKey && <button type="button" className="secondary" onClick={() => { setEditingFeatureKey(''); setFeatureKey(''); setFeatureName(''); setFeatureDescription(''); setFeatureCategory(''); }}>Cancel</button>}</div>
          </form>
        </div>
      </section>

      <section className="df-platform-panel">
        <div className="df-platform-panel-header"><div><h2>Plans & entitlement matrix</h2><p>Plan changes are snapshotted for existing subscriptions. No preset commercial matrix is assumed.</p></div></div>
        <div className="df-subscription-content">
          <div className="df-subscription-plan-list">
            {!plans.length && <div className="df-platform-empty">Create a plan to configure an entitlement matrix.</div>}
            {plans.map((plan) => <article className="df-subscription-plan-card" key={plan.id}>
              <div><strong>{plan.name}</strong><small>{plan.planKey} · {plan.active ? 'Active' : 'Inactive'}{plan.customPlan ? ' · Custom' : ''}</small><p>{plan.description || 'No description'}</p><small>{plan.features.filter((feature) => feature.enabled).length} enabled features</small></div>
              <button type="button" className="df-platform-table-action" disabled={busy} onClick={() => editPlan(plan)}>Edit matrix</button>
            </article>)}
          </div>
          <form className="df-subscription-form df-subscription-plan-form" onSubmit={(event) => { void savePlan(event); }}>
            <h3>{editingPlanId ? `Edit ${planKey}` : 'Create plan'}</h3>
            <div className="df-subscription-form-row">
              <label>Plan key<input required maxLength={80} pattern="[A-Za-z0-9_-]{2,80}" disabled={Boolean(editingPlanId)} value={planKey} onChange={(event) => setPlanKey(event.target.value)} placeholder="TEAM" /></label>
              <label>Name<input required maxLength={120} value={planName} onChange={(event) => setPlanName(event.target.value)} /></label>
            </div>
            <label>Description<textarea maxLength={4000} value={planDescription} onChange={(event) => setPlanDescription(event.target.value)} /></label>
            <div className="df-subscription-checkbox-row"><label className="df-subscription-check"><input type="checkbox" checked={planActive} onChange={(event) => setPlanActive(event.target.checked)} /> Available for assignment</label><label className="df-subscription-check"><input type="checkbox" checked={customPlan} onChange={(event) => setCustomPlan(event.target.checked)} /> Custom plan</label></div>
            <h4>Entitlements & optional limits</h4>
            {planFeatures.length ? <div className="df-subscription-matrix">
              {planFeatures.map((mapping) => {
                const feature = features.find((item) => item.featureKey === mapping.featureKey);
                return <div className="df-subscription-matrix-row" key={mapping.featureKey}>
                  <label className="df-subscription-check"><input type="checkbox" checked={mapping.enabled} disabled={!feature?.active} onChange={(event) => setPlanFeatures((current) => current.map((item) => item.featureKey === mapping.featureKey ? { ...item, enabled: event.target.checked } : item))} /><span>{feature?.name ?? mapping.featureKey}<small>{mapping.featureKey}</small></span></label>
                  {feature?.limitsSupported && <textarea aria-label={`${mapping.featureKey} limits JSON`} value={mapping.limitsText} onChange={(event) => setPlanFeatures((current) => current.map((item) => item.featureKey === mapping.featureKey ? { ...item, limitsText: event.target.value } : item))} />}
                </div>;
              })}
            </div> : <p className="df-subscription-muted">Add features before defining the matrix.</p>}
            <div className="df-subscription-actions"><button disabled={busy}>{editingPlanId ? 'Save plan changes' : 'Create plan'}</button>{editingPlanId && <button type="button" className="secondary" onClick={resetPlanForm}>Cancel</button>}</div>
          </form>
        </div>
      </section>

      <section className="df-platform-panel">
        <div className="df-platform-panel-header"><div><h2>Restaurant subscription</h2><p>Assign a trial or paid period and review lifecycle history.</p></div><select aria-label="Restaurant" value={restaurantId} onChange={(event) => setRestaurantId(event.target.value)}><option value="">Select restaurant</option>{restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.restaurantId}>{restaurant.name} · {restaurant.restaurantId}</option>)}</select></div>
        <div className="df-subscription-content">
          <form className="df-subscription-form" onSubmit={(event) => { void assignSubscription(event); }}>
            <h3>Assign plan</h3>
            <label>Plan<select required value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)}><option value="">Select plan</option>{plans.filter((plan) => plan.active).map((plan) => <option key={plan.id} value={plan.id}>{plan.name} ({plan.planKey})</option>)}</select></label>
            <div className="df-subscription-form-row"><label>Initial status<select value={subscriptionStatus} onChange={(event) => setSubscriptionStatus(event.target.value as 'TRIALING' | 'ACTIVE')}><option value="TRIALING">14-day trial</option><option value="ACTIVE">Active</option></select></label><label>Billing period<select value={billingPeriod} onChange={(event) => setBillingPeriod(event.target.value as typeof billingPeriod)}><option value="MONTHLY">Monthly</option><option value="ANNUAL">Annual</option><option value="CUSTOM">Custom</option></select></label></div>
            {subscriptionStatus === 'ACTIVE' && billingPeriod === 'CUSTOM' && <label>Paid-through date/time<input type="datetime-local" required value={customPeriodEnd} onChange={(event) => setCustomPeriodEnd(event.target.value)} /></label>}
            <button disabled={busy || !restaurantId || !selectedPlanId}>Assign subscription</button>
          </form>
          <div className="df-subscription-history">
            <h3>Subscription history</h3>
            {!subscriptions.length && <p className="df-subscription-muted">No subscriptions assigned.</p>}
            {subscriptions.map((subscription) => <article className="df-subscription-history-item" key={subscription.id}>
              <div><strong>{subscription.planName} <span className={`df-platform-pill ${subscription.status.toLowerCase()}`}>{subscription.status}</span></strong><small>{subscription.billingPeriod} · started {new Date(subscription.startsAt).toLocaleString()}</small>{subscription.trialEndsAt && <small>Trial ends {new Date(subscription.trialEndsAt).toLocaleString()}</small>}{subscription.currentPeriodEnd && <small>Period ends {new Date(subscription.currentPeriodEnd).toLocaleString()}</small>}<small>Snapshot: {Object.keys(subscription.entitlementsSnapshot).length} features</small></div>
              {subscription.status !== 'EXPIRED' && <div className="df-platform-row-actions">
                {subscription.status !== 'ACTIVE' && <button type="button" disabled={busy} onClick={() => transitionSubscription(subscription, 'ACTIVE')}>Activate</button>}
                {subscription.status === 'ACTIVE' && <button type="button" disabled={busy} onClick={() => transitionSubscription(subscription, 'PAST_DUE')}>Mark past due</button>}
                {['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(subscription.status) && <button type="button" className="danger" disabled={busy} onClick={() => transitionSubscription(subscription, 'CANCELLED')}>Cancel</button>}
                {['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(subscription.status) && <button type="button" className="danger" disabled={busy} onClick={() => transitionSubscription(subscription, 'SUSPENDED')}>Suspend</button>}
              </div>}
            </article>)}
          </div>
        </div>
      </section>

      <section className="df-platform-panel">
        <div className="df-platform-panel-header"><div><h2>Restaurant feature overrides</h2><p>Overrides require a reason and support scheduled start/end times; the latest valid override takes precedence.</p></div></div>
        <div className="df-subscription-content">
          <form className="df-subscription-form" onSubmit={(event) => { void createOverride(event); }}>
            <h3>Add override</h3>
            <label>Feature<select required value={overrideFeature} onChange={(event) => setOverrideFeature(event.target.value)}><option value="">Select feature</option>{features.filter((feature) => feature.active).map((feature) => <option key={feature.featureKey} value={feature.featureKey}>{feature.name}</option>)}</select></label>
            <label>Decision<select value={overrideEnabled ? 'enabled' : 'disabled'} onChange={(event) => setOverrideEnabled(event.target.value === 'enabled')}><option value="enabled">Enable feature</option><option value="disabled">Disable feature</option></select></label>
            <label>Reason<textarea required maxLength={2000} value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} /></label>
            <div className="df-subscription-form-row"><label>Starts<input type="datetime-local" value={overrideFrom} onChange={(event) => setOverrideFrom(event.target.value)} /></label><label>Ends (optional)<input type="datetime-local" value={overrideUntil} onChange={(event) => setOverrideUntil(event.target.value)} /></label></div>
            <button disabled={busy || !restaurantId}>Save override</button>
          </form>
          <div className="df-subscription-history">
            <h3>Override history</h3>
            {!overrides.length && <p className="df-subscription-muted">No feature overrides for this restaurant.</p>}
            {overrides.map((override) => <article className="df-subscription-history-item" key={override.id}>
              <div><strong>{override.featureKey} · {override.enabled ? 'Enabled' : 'Disabled'} <span className={`df-platform-pill ${override.revokedAt ? 'rejected' : 'active'}`}>{override.revokedAt ? 'REVOKED' : 'ACTIVE'}</span></strong><small>{override.reason}</small><small>From {new Date(override.validFrom).toLocaleString()}{override.validUntil ? ` to ${new Date(override.validUntil).toLocaleString()}` : ' · no scheduled end'}</small></div>
              {!override.revokedAt && <button type="button" className="df-platform-table-action danger" disabled={busy} onClick={() => revokeOverride(override)}>Revoke</button>}
            </article>)}
          </div>
        </div>
      </section>
    </div>
  );
}
