const { adminClient, json, requireUser } = require('./_lib/supabase');
const { getAccess, isSuperAdmin } = require('./_lib/rbac');

const VALID_ROLES = ['owner', 'finance_manager', 'accountant', 'branch_manager', 'auditor', 'viewer', 'super_admin'];

async function audit(admin, actor, action, metadata, branchId = null){
  await admin.from('audit_logs').insert({ user_id: actor, action, branch_id: branchId, metadata });
}

async function listAllUsers(admin){
  const users = [];
  let page = 1;
  while(true){
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if(error) throw new Error(error.message);
    users.push(...(data.users || []));
    if(!data.users || data.users.length < 1000) break;
    page++;
  }
  return users;
}

exports.handler = async event => {
  const admin = adminClient();
  const auth = await requireUser(event);
  if(auth.error) return json(401, { error: auth.error });
  const access = await getAccess(admin, auth.user.id);
  if(!isSuperAdmin(access, auth.user)) return json(403, { error: 'Super-admin access required.' });

  try{
    if(event.httpMethod === 'GET'){
      const params = event.queryStringParameters || {};
      const search = String(params.search || '').trim().toLowerCase();
      const users = (await listAllUsers(admin)).filter(u => !search || `${u.email || ''} ${u.id}`.toLowerCase().includes(search));
      const { data: grants, error: grantsError } = await admin
        .from('user_branch_access').select('user_id, branch_id, role, granted_at, branches(name, code)');
      if(grantsError) throw new Error(grantsError.message);
      const byUser = new Map();
      for(const grant of grants || []){
        if(!byUser.has(grant.user_id)) byUser.set(grant.user_id, []);
        byUser.get(grant.user_id).push(grant);
      }
      return json(200, { users: users.map(u => ({
        id: u.id, email: u.email, provider: u.app_metadata?.provider || 'email',
        created_at: u.created_at, last_sign_in_at: u.last_sign_in_at,
        status: u.banned_until && new Date(u.banned_until) > new Date() ? 'suspended' : 'active',
        branches: byUser.get(u.id) || []
      })) });
    }

    if(event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch(e) { return json(400, { error: 'Invalid JSON body.' }); }
    const targetId = String(body.user_id || '');
    if(!targetId) return json(400, { error: 'user_id is required.' });
    if(targetId === auth.user.id && ['revoke', 'suspend'].includes(body.action)) return json(400, { error: 'You cannot remove your own admin access.' });

    if(body.action === 'grant'){
      if(!body.branch_id || !VALID_ROLES.includes(body.role)) return json(400, { error: 'branch_id and a valid role are required.' });
      const { data, error } = await admin.from('user_branch_access').upsert({
        user_id: targetId, branch_id: body.branch_id, role: body.role, granted_by: auth.user.id
      }, { onConflict: 'user_id,branch_id' }).select().maybeSingle();
      if(error) return json(500, { error: error.message });
      await audit(admin, auth.user.id, 'admin.grant_access', { target_user_id: targetId, role: body.role }, body.branch_id);
      return json(200, { grant: data });
    }

    if(body.action === 'revoke'){
      const query = admin.from('user_branch_access').delete().eq('user_id', targetId);
      const { error } = body.branch_id ? await query.eq('branch_id', body.branch_id) : await query;
      if(error) return json(500, { error: error.message });
      await audit(admin, auth.user.id, 'admin.revoke_access', { target_user_id: targetId }, body.branch_id || null);
      return json(200, { ok: true });
    }

    if(body.action === 'status'){
      if(!['active', 'suspended'].includes(body.status)) return json(400, { error: 'status must be active or suspended.' });
      const { data, error } = await admin.auth.admin.updateUserById(targetId, { ban_duration: body.status === 'suspended' ? '876000h' : 'none' });
      if(error) return json(500, { error: error.message });
      await audit(admin, auth.user.id, `admin.${body.status}_user`, { target_user_id: targetId });
      return json(200, { user: { id: data.user.id, status: body.status } });
    }

    if(body.action === 'password_reset'){
      const { data: target, error: targetError } = await admin.auth.admin.getUserById(targetId);
      if(targetError || !target.user?.email) return json(404, { error: 'Target user email was not found.' });
      const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email: target.user.email });
      if(error) return json(500, { error: error.message });
      await audit(admin, auth.user.id, 'admin.password_reset_requested', { target_user_id: targetId });
      return json(200, { ok: true, action_link: data.properties?.action_link || null });
    }

    return json(400, { error: 'Unknown admin action.' });
  }catch(error){
    console.error('admin-users error', error);
    return json(500, { error: 'Admin user operation failed.' });
  }
};
