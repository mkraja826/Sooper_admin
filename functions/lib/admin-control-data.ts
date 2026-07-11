import type { AdminClient } from './admin-control-shared';

export async function loadAdminControlData(admin: AdminClient) {
  const [clinics, profiles, invites, subscriptions, audits] = await Promise.all([
    admin
      .from('clinics')
      .select('id,name,phone,email,address,logo_url,brand_color,active,enable_patient_photos,enable_prescription_medications,op_fee_amount,created_at')
      .order('created_at', { ascending: false }),
    admin
      .from('profiles')
      .select('id,clinic_id,name,email,phone,role,active,created_at')
      .order('created_at', { ascending: false }),
    admin
      .from('staff_invites')
      .select('id,clinic_id,email,name,role,invite_code,accepted_at,created_at')
      .order('created_at', { ascending: false }),
    admin
      .from('clinic_subscriptions')
      .select('id,clinic_id,plan_name,status,trial_started_at,trial_ends_at,current_period_start,current_period_end,monthly_price,visit_limit,billing_provider,google_play_status,google_play_auto_renewing,updated_at,created_at')
      .order('updated_at', { ascending: false }),
    admin
      .from('admin_audit_logs')
      .select('id,actor_email,action,target_type,target_id,clinic_id,details,created_at')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  const firstError = [clinics.error, profiles.error, invites.error, subscriptions.error, audits.error].find(Boolean);
  if (firstError) throw new Error(firstError.message);

  return {
    clinics: clinics.data || [],
    profiles: profiles.data || [],
    invites: invites.data || [],
    subscriptions: subscriptions.data || [],
    audits: audits.data || [],
  };
}
