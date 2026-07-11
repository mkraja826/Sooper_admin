import {
  cleanText,
  INVITE_ROLES,
  randomInviteCode,
  requiredText,
  STAFF_ROLES,
  type AdminClient,
  type MasterIdentity,
  writeAudit,
} from './admin-control-shared';

export async function handlePeopleAction(
  admin: AdminClient,
  identity: MasterIdentity,
  action: string,
  body: Record<string, unknown>,
) {
  if (action === 'update_staff') {
    const staffId = requiredText(body.staff_id, 'Staff ID', 80);
    const updates: Record<string, unknown> = {};

    if ('name' in body) updates.name = requiredText(body.name, 'Staff name', 160);
    if ('phone' in body) updates.phone = cleanText(body.phone, 40) || null;
    if ('active' in body) updates.active = body.active === true;
    if ('role' in body) {
      const role = cleanText(body.role, 40);
      if (!STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number])) throw new Error('Unsupported staff role');
      updates.role = role;
    }

    if (!Object.keys(updates).length) throw new Error('No staff changes supplied');

    const { data: profile, error } = await admin
      .from('profiles')
      .update(updates)
      .eq('id', staffId)
      .select('id,clinic_id,name,email,phone,role,active')
      .single();
    if (error) throw error;

    await writeAudit(admin, identity, 'update_staff', 'profile', staffId, String(profile.clinic_id), updates);
    return { ok: true, profile };
  }

  if (action === 'create_staff_invite') {
    const clinicId = requiredText(body.clinic_id, 'Clinic ID', 80);
    const email = requiredText(body.email, 'Email', 180).toLowerCase();
    const name = requiredText(body.name, 'Name', 160);
    const role = requiredText(body.role, 'Role', 40);

    if (!INVITE_ROLES.includes(role as (typeof INVITE_ROLES)[number])) throw new Error('Unsupported invite role');

    const { data: invite, error } = await admin
      .from('staff_invites')
      .upsert(
        {
          clinic_id: clinicId,
          email,
          name,
          role,
          invite_code: randomInviteCode(),
          accepted_at: null,
        },
        { onConflict: 'clinic_id,email' },
      )
      .select('*')
      .single();
    if (error) throw error;

    await writeAudit(admin, identity, 'create_staff_invite', 'staff_invite', String(invite.id), clinicId, {
      email,
      name,
      role,
    });
    return { ok: true, invite };
  }

  if (action === 'revoke_staff_invite') {
    const inviteId = requiredText(body.invite_id, 'Invite ID', 80);
    const { data: invite, error: findError } = await admin
      .from('staff_invites')
      .select('id,clinic_id,email,name,role')
      .eq('id', inviteId)
      .single();
    if (findError) throw findError;

    const { error } = await admin.from('staff_invites').delete().eq('id', inviteId);
    if (error) throw error;

    await writeAudit(admin, identity, 'revoke_staff_invite', 'staff_invite', inviteId, String(invite.clinic_id), invite);
    return { ok: true };
  }

  return null;
}
