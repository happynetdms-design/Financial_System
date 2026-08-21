const { adminClient, json, requireUser } = require('./_lib/supabase');
const { getAccess, isSuperAdmin } = require('./_lib/rbac');

exports.handler = async event => {
  if(event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  const admin = adminClient();
  const auth = await requireUser(event);
  if(auth.error) return json(401, { error: auth.error });
  const access = await getAccess(admin, auth.user.id);
  if(!isSuperAdmin(access, auth.user)) return json(403, { error: 'Super-admin access required.' });

  try{
    const body = JSON.parse(event.body || '{}');
    if(!body.user_id || body.user_id === auth.user.id) return json(400, { error: 'A different target user_id is required.' });
    const { data: target, error: targetError } = await admin.auth.admin.getUserById(body.user_id);
    if(targetError || !target.user?.email) return json(404, { error: 'Target user was not found.' });

    // Supabase does not expose a server-side "mint session as another user"
    // API. A short-lived recovery link is the supported handoff mechanism;
    // the client keeps the original admin token and labels the handoff.
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink', email: target.user.email,
      options: { redirectTo: `${new URL(event.rawUrl || 'http://localhost').origin}/` }
    });
    if(linkError) return json(500, { error: linkError.message });

    const { error: auditError } = await admin.from('audit_logs').insert({
      user_id: auth.user.id,
      action: 'admin.impersonation_started',
      metadata: { target_user_id: target.user.id, target_email: target.user.email, impersonated_by: auth.user.id }
    });
    if(auditError) return json(500, { error: 'Could not record impersonation audit event.' });
    return json(200, { action_link: link.properties?.action_link || null, impersonated_by: auth.user.id, target: { id: target.user.id, email: target.user.email } });
  }catch(error){
    console.error('admin-impersonate error', error);
    return json(400, { error: 'Invalid impersonation request.' });
  }
};
