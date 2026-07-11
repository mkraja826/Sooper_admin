import { handleClinicAction } from '../lib/admin-control-clinic-actions';
import { loadAdminControlData } from '../lib/admin-control-data';
import { handlePeopleAction } from '../lib/admin-control-people-actions';
import { handleSubscriptionAction } from '../lib/admin-control-subscription-actions';
import {
  getAdmin,
  json,
  requireMaster,
  requiredText,
  type AdminEnv,
} from '../lib/admin-control-shared';

export async function onRequestGet(context: { request: Request; env: AdminEnv }) {
  const auth = await requireMaster(context.request, context.env);
  if (!auth.ok) return auth.response;

  try {
    return json(await loadAdminControlData(getAdmin(context.env)));
  } catch (reason) {
    return json({ error: reason instanceof Error ? reason.message : 'Unable to load admin controls' }, 500);
  }
}

export async function onRequestPost(context: { request: Request; env: AdminEnv }) {
  const auth = await requireMaster(context.request, context.env);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid JSON request body' }, 400);
  }

  try {
    const action = requiredText(body.action, 'Action', 80);
    const admin = getAdmin(context.env);

    const result =
      (await handleClinicAction(admin, auth.identity, action, body)) ||
      (await handlePeopleAction(admin, auth.identity, action, body)) ||
      (await handleSubscriptionAction(admin, auth.identity, action, body));

    if (!result) return json({ error: 'Unknown admin action' }, 400);
    return json(result);
  } catch (reason) {
    return json({ error: reason instanceof Error ? reason.message : 'Admin action failed' }, 400);
  }
}
