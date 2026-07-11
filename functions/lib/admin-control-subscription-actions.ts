import {
  BILLING_PROVIDERS,
  cleanText,
  optionalDate,
  optionalNumber,
  requiredText,
  SUBSCRIPTION_STATUSES,
  type AdminClient,
  type MasterIdentity,
  writeAudit,
} from './admin-control-shared';

export async function handleSubscriptionAction(
  admin: AdminClient,
  identity: MasterIdentity,
  action: string,
  body: Record<string, unknown>,
) {
  if (action === 'update_subscription') {
    const clinicId = requiredText(body.clinic_id, 'Clinic ID', 80);
    const status = cleanText(body.status, 40);
    const provider = cleanText(body.billing_provider, 40);

    if (status && !SUBSCRIPTION_STATUSES.includes(status as (typeof SUBSCRIPTION_STATUSES)[number])) {
      throw new Error('Unsupported subscription status');
    }
    if (provider && !BILLING_PROVIDERS.includes(provider as (typeof BILLING_PROVIDERS)[number])) {
      throw new Error('Unsupported billing provider');
    }

    const updates: Record<string, unknown> = {
      clinic_id: clinicId,
      updated_at: new Date().toISOString(),
    };

    if ('plan_name' in body) updates.plan_name = requiredText(body.plan_name, 'Plan name', 80);
    if (status) updates.status = status;
    if (provider) updates.billing_provider = provider;
    if ('monthly_price' in body) updates.monthly_price = optionalNumber(body.monthly_price, 'Monthly price') ?? 0;
    if ('visit_limit' in body) updates.visit_limit = optionalNumber(body.visit_limit, 'Visit limit');
    if ('trial_ends_at' in body) updates.trial_ends_at = optionalDate(body.trial_ends_at, 'Trial end date');
    if ('current_period_start' in body) updates.current_period_start = optionalDate(body.current_period_start, 'Period start');
    if ('current_period_end' in body) updates.current_period_end = optionalDate(body.current_period_end, 'Period end');

    const { data: subscription, error } = await admin
      .from('clinic_subscriptions')
      .upsert(updates, { onConflict: 'clinic_id' })
      .select('*')
      .single();
    if (error) throw error;

    await writeAudit(
      admin,
      identity,
      'update_subscription',
      'clinic_subscription',
      String(subscription.id),
      clinicId,
      updates,
    );
    return { ok: true, subscription };
  }

  if (action === 'reset_trial') {
    const clinicId = requiredText(body.clinic_id, 'Clinic ID', 80);
    const days = Math.max(1, Math.min(365, Number(body.days || 90)));
    const now = new Date();
    const trialEnd = new Date(now.getTime() + days * 86_400_000);
    const values = {
      clinic_id: clinicId,
      plan_name: 'trial',
      status: 'trial',
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEnd.toISOString(),
      billing_provider: 'manual',
      updated_at: now.toISOString(),
    };

    const { data: subscription, error } = await admin
      .from('clinic_subscriptions')
      .upsert(values, { onConflict: 'clinic_id' })
      .select('*')
      .single();
    if (error) throw error;

    await writeAudit(
      admin,
      identity,
      'reset_trial',
      'clinic_subscription',
      String(subscription.id),
      clinicId,
      { days, trial_ends_at: trialEnd.toISOString() },
    );
    return { ok: true, subscription };
  }

  return null;
}
