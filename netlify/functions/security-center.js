const { requireUser, adminClient, json } = require('./_lib/supabase');
const { getAccess } = require('./_lib/rbac');

const READ_ROLES = ['owner','finance_manager','branch_manager','accountant','auditor','viewer'];
const WRITE_ROLES = ['owner','finance_manager','branch_manager','accountant'];

exports.handler = async event => {
  const auth = await requireUser(event);
  if (auth.error) return json(401, { error: auth.error });
  const admin = adminClient();
  try {
    const access = await getAccess(admin, auth.user.id);
    if (!access.isHeadOffice) return json(403, { error: 'Head Office access required.' });

    if (event.httpMethod === 'GET') {
      const [controls, events] = await Promise.all([
        admin.from('hfms_security_controls').select('*').eq('enabled', true).order('severity').order('control_key'),
        admin.from('hfms_security_events').select('id,event_type,action,resource,result,metadata,created_at,actor_user_id').order('created_at', { ascending:false }).limit(50)
      ]);
      if (controls.error) throw new Error(controls.error.message);
      if (events.error) throw new Error(events.error.message);
      const grants = access.grants.map(g => ({ branch_id:g.branch_id, branch_name:g.branches?.name || null, role:g.role }));
      const roleCoverage = [...new Set(grants.map(g=>g.role))].map(role => ({
        role,
        read: READ_ROLES.includes(role),
        write: WRITE_ROLES.includes(role),
        approval: ['owner','finance_manager'].includes(role)
      }));
      const env = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_ANON_KEY'].map(key => ({key, configured: !!process.env[key]}));
      const passed = (controls.data || []).filter(c => c.status === 'PASS').length;
      const score = (controls.data || []).length ? Math.round(passed / controls.data.length * 100) : 0;
      return json(200, { generated_at:new Date().toISOString(), score, controls:controls.data||[], events:events.data||[], grants, role_coverage:roleCoverage, environment:env });
    }

    if (event.httpMethod !== 'POST') return json(405, { error:'GET or POST only.' });
    const body = JSON.parse(event.body || '{}');
    const action = body.action;
    if (!action) return json(400, { error:'action is required.' });

    if (action === 'record_event') {
      const row = {
        branch_id: body.branch_id || null,
        actor_user_id: auth.user.id,
        event_type: String(body.event_type || 'security_event').slice(0,80),
        action: String(body.action_name || 'unknown').slice(0,120),
        resource: String(body.resource || 'unknown').slice(0,160),
        result: String(body.result || 'SUCCESS').slice(0,30),
        metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {}
      };
      const { data, error } = await admin.from('hfms_security_events').insert(row).select().single();
      if (error) return json(400, { error:error.message });
      return json(200, { event:data });
    }

    if (action === 'run_smoke_test') {
      const checks = [];
      checks.push({control:'authenticated_identity', status:auth.user?.id ? 'PASS':'FAIL'});
      checks.push({control:'head_office_authorization', status:access.isHeadOffice ? 'PASS':'FAIL'});
      checks.push({control:'role_matrix_loaded', status:access.grants.length ? 'PASS':'WARN', detail:`${access.grants.length} access grants loaded`});
      for (const table of ['audit_log','user_branch_access','financial_transactions','journal_entries','hfms_notification_queue','hfms_security_events']) {
        const { error } = await admin.from(table).select('id',{head:true,count:'exact'}).limit(1);
        checks.push({control:`data_plane:${table}`,status:error?'FAIL':'PASS',detail:error?.message||null});
      }
      const passed = checks.filter(c=>c.status==='PASS').length;
      const score = Math.round(passed/checks.length*100);
      await admin.from('hfms_security_events').insert({
        actor_user_id:auth.user.id,event_type:'security_smoke_test',action:'run_smoke_test',resource:'HFMS',result:score===100?'PASS':'REVIEW',metadata:{checks,score}
      });
      return json(200,{score,checks,generated_at:new Date().toISOString()});
    }
    return json(400,{error:'Unknown security action.'});
  } catch(e) {
    console.error('security-center', e);
    return json(500,{error:'Security center unavailable.'});
  }
};
