const { adminClient, json, requireUser, bearerToken } = require('./_lib/supabase');
const { getAccess } = require('./_lib/rbac');

exports.handler = async event => {
  const auth = await requireUser(event);
  if(auth.error) return json(401, { error: auth.error });
  const admin = auth.admin || adminClient();
  try{
    if(event.httpMethod === 'GET'){
      const access = await getAccess(admin, auth.user.id);
      const { data: profile, error } = await admin.from('user_profiles').select('*').eq('user_id', auth.user.id).maybeSingle();
      if(error) return json(500, { error: error.message });
      return json(200, {
        user: { id: auth.user.id, email: auth.user.email, created_at: auth.user.created_at, last_sign_in_at: auth.user.last_sign_in_at, provider: auth.user.app_metadata?.provider || 'email' },
        profile: profile || {},
        branches: access.grants,
        is_super_admin: !!access.isSuperAdmin
      });
    }
    if(event.httpMethod === 'PUT'){
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch(e) { return json(400, { error: 'Invalid JSON body.' }); }
      const allowed = ['first_name','last_name','phone','job_title','department','preferences'];
      const update = Object.fromEntries(allowed.filter(key => body[key] !== undefined).map(key => [key, body[key]]));
      if(update.preferences && typeof update.preferences !== 'object') return json(400, { error: 'preferences must be an object.' });
      const { data, error } = await admin.from('user_profiles').upsert({ user_id: auth.user.id, ...update }, { onConflict: 'user_id' }).select().maybeSingle();
      if(error) return json(500, { error: error.message });
      return json(200, { profile: data });
    }
    if(event.httpMethod === 'POST'){
      const body = JSON.parse(event.body || '{}');
      if(body.action !== 'sign_out_other_devices') return json(400, { error: 'Unknown profile action.' });
      const { error } = await admin.auth.admin.signOut(bearerToken(event), 'others');
      if(error) return json(500, { error: error.message });
      await admin.from('audit_logs').insert({ user_id: auth.user.id, action: 'profile.sign_out_other_devices', metadata: {} });
      return json(200, { ok: true });
    }
    return json(405, { error: 'Method not allowed.' });
  }catch(error){
    console.error('profile error', error);
    return json(500, { error: 'Profile operation failed.' });
  }
};
