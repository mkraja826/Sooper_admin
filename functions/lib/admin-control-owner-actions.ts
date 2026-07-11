import {
  cleanText,
  requiredText,
  type AdminClient,
  type MasterIdentity,
  writeAudit,
} from './admin-control-shared';

export async function handleOwnerAction(
  admin: AdminClient,
  identity: MasterIdentity,
  action: string,
  body: Record<string, unknown>,
) {
  if (action !== 'invite_clinic_owner') return null;

  const clinicId = requiredText(body.clinic_id, 'Clinic ID', 80);
  const name = requiredText(body.name, 'Owner name', 160);
  const email = requiredText(body.email, 'Owner email', 180).toLowerCase();
  const phone = cleanText(body.phone, 40) || null;

  const { data: clinic, error: clinicError } = await admin.from('clinics').select('id,name').eq('id', clinicId).single();
  if (clinicError) throw clinicError;

  const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) throw usersError;

  let ownerUser = usersData.users.find((user) => user.email?.toLowerCase() === email) || null;
  let invited = false;

  if (!ownerUser) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { name, role: 'head_doctor', clinic_id: clinicId },
    });
    if (error) throw error;
    ownerUser = data.user;
    invited = true;
  }

  if (!ownerUser) throw new Error('Owner account could not be created');

  const { data: existingProfile, error: profileLookupError } = await admin
    .from('profiles')
    .select('clinic_id')
    .eq('id', ownerUser.id)
    .maybeSingle();
  if (profileLookupError) throw profileLookupError;
  if (existingProfile?.clinic_id && existingProfile.clinic_id !== clinicId) {
    throw new Error('This email is already linked to another clinic');
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .upsert({
      id: ownerUser.id,
      clinic_id: clinicId,
      name,
      email,
      phone,
      role: 'head_doctor',
      active: true,
    })
    .select('id,clinic_id,name,email,phone,role,active')
    .single();
  if (profileError) throw profileError;

  await writeAudit(admin, identity, 'invite_clinic_owner', 'profile', ownerUser.id, clinicId, {
    clinic_name: clinic.name,
    email,
    invited,
  });

  return { ok: true, profile, invitation_sent: invited };
}
