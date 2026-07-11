import {
  cleanText,
  optionalNumber,
  requiredText,
  type AdminClient,
  type MasterIdentity,
  writeAudit,
} from './admin-control-shared';

export async function handleClinicAction(
  admin: AdminClient,
  identity: MasterIdentity,
  action: string,
  body: Record<string, unknown>,
) {
  if (action === 'create_clinic') {
    const payload = {
      name: requiredText(body.name, 'Clinic name', 160),
      phone: cleanText(body.phone, 40) || null,
      email: cleanText(body.email, 180).toLowerCase() || null,
      address: cleanText(body.address, 800) || null,
      brand_color: cleanText(body.brand_color, 20) || '#0F766E',
      active: true,
      enable_patient_photos: body.enable_patient_photos === true,
      enable_prescription_medications: body.enable_prescription_medications === true,
      op_fee_amount: optionalNumber(body.op_fee_amount, 'OP fee') ?? 300,
    };

    const { data: clinic, error } = await admin.from('clinics').insert(payload).select('*').single();
    if (error) throw error;

    const trialDays = Math.max(1, Math.min(365, Number(body.trial_days || 90)));
    const now = new Date();
    const trialEnd = new Date(now.getTime() + trialDays * 86_400_000);
    const { error: subscriptionError } = await admin.from('clinic_subscriptions').upsert(
      {
        clinic_id: clinic.id,
        plan_name: 'trial',
        status: 'trial',
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEnd.toISOString(),
        monthly_price: optionalNumber(body.monthly_price, 'Monthly price') ?? 799,
        billing_provider: 'manual',
        updated_at: now.toISOString(),
      },
      { onConflict: 'clinic_id' },
    );
    if (subscriptionError) throw subscriptionError;

    await writeAudit(admin, identity, 'create_clinic', 'clinic', String(clinic.id), String(clinic.id), {
      name: clinic.name,
      trial_days: trialDays,
    });

    return { ok: true, clinic };
  }

  if (action === 'update_clinic') {
    const clinicId = requiredText(body.clinic_id, 'Clinic ID', 80);
    const updates: Record<string, unknown> = {};

    if ('name' in body) updates.name = requiredText(body.name, 'Clinic name', 160);
    if ('phone' in body) updates.phone = cleanText(body.phone, 40) || null;
    if ('email' in body) updates.email = cleanText(body.email, 180).toLowerCase() || null;
    if ('address' in body) updates.address = cleanText(body.address, 800) || null;
    if ('brand_color' in body) updates.brand_color = cleanText(body.brand_color, 20) || '#0F766E';
    if ('enable_patient_photos' in body) updates.enable_patient_photos = body.enable_patient_photos === true;
    if ('enable_prescription_medications' in body) updates.enable_prescription_medications = body.enable_prescription_medications === true;
    if ('op_fee_amount' in body) updates.op_fee_amount = optionalNumber(body.op_fee_amount, 'OP fee') ?? 0;

    if (!Object.keys(updates).length) throw new Error('No clinic changes supplied');

    const { data: clinic, error } = await admin.from('clinics').update(updates).eq('id', clinicId).select('*').single();
    if (error) throw error;

    await writeAudit(admin, identity, 'update_clinic', 'clinic', clinicId, clinicId, updates);
    return { ok: true, clinic };
  }

  if (action === 'set_clinic_active') {
    const clinicId = requiredText(body.clinic_id, 'Clinic ID', 80);
    const active = body.active === true;

    if (!active && cleanText(body.confirmation, 80) !== 'SUSPEND') {
      throw new Error('Type SUSPEND to confirm clinic suspension');
    }

    const { data: clinic, error } = await admin
      .from('clinics')
      .update({ active })
      .eq('id', clinicId)
      .select('id,name,active')
      .single();
    if (error) throw error;

    await writeAudit(
      admin,
      identity,
      active ? 'reactivate_clinic' : 'suspend_clinic',
      'clinic',
      clinicId,
      clinicId,
      { active, reason: cleanText(body.reason, 500) || null },
    );

    return { ok: true, clinic };
  }

  return null;
}
