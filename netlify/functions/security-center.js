const { requireUser, adminClient, json } = require('./_lib/supabase');
const { getAccess } = require('./_lib/rbac');

const READ_ROLES = ['owner', 'finance_manager', 'branch_manager', 'accountant', 'auditor', 'viewer'];
const WRITE_ROLES = ['owner', 'finance_manager', 'branch_manager', 'accountant'];
const ALLOWED_METHODS = ['GET', 'POST'];

exports.handler = async event => {
  // 1. HTTP Method Gate
  if (!ALLOWED_METHODS.includes(event.httpMethod)) {
    return json(405, { error: 'Method Not Allowed. GET or POST only.' });
  }

  // 2. Authentication Check
  const auth = await requireUser(event);
  if (auth.error) return json(401, { error: auth.error });

  const admin = adminClient();

  try {
    // 3. Authorization / RBAC Check
    const access = await getAccess(admin, auth.user.id);
    if (!access || !access.isHeadOffice) {
      return json(403, { error: 'Head Office access required.' });
    }

    // Safe fallback for grants
    const grantsList = Array.isArray(access.grants) ? access.grants : [];

    // --- GET HANDLER ---
    if (event.httpMethod === 'GET') {
      const [controls, events] = await Promise.all([
        admin
          .from('hfms_security_controls')
          .select('*')
          .eq('enabled', true)
          .order('severity')
          .order('control_key'),
        admin
          .from('hfms_security_events')
          .select('id,event_type,action,resource,result,metadata,created_at,actor_user_id')
          .order('created_at', { ascending: false })
          .limit(50)
      ]);

      if (controls.error) throw new Error(`Controls Query Error: ${controls.error.message}`);
      if (events.error) throw new Error(`Events Query Error: ${events.error.message}`);

      const grants = grantsList.map(g => ({
        branch_id: g.branch_id || null,
        branch_name: g.branches?.name || g.branch_name || null,
        role: g.role || 'viewer'
      }));

      const uniqueRoles = [...new Set(grants.map(g => g.role))];
      const roleCoverage = uniqueRoles.map(role => ({
        role,
        read: READ_ROLES.includes(role),
        write: WRITE_ROLES.includes(role),
        approval: ['owner', 'finance_manager'].includes(role)
      }));

      const env = [
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'SUPABASE_ANON_KEY'
      ].map(key => ({ key, configured: !!process.env[key] }));

      const activeControls = controls.data || [];
      const passed = activeControls.filter(c => c.status === 'PASS').length;
      const score = activeControls.length ? Math.round((passed / activeControls.length) * 100) : 0;

      return json(200, {
        generated_at: new Date().toISOString(),
        score,
        controls: activeControls,
        events: events.data || [],
        grants,
        role_coverage: roleCoverage,
        environment: env
      });
    }

    // --- POST HANDLER ---
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return json(400, { error: 'Invalid JSON payload in request body.' });
    }

    const action = body.action;
    if (!action || typeof action !== 'string') {
      return json(400, { error: 'A valid string action is required.' });
    }

    // ACTION: Record Security Event
    if (action === 'record_event') {
      const row = {
        branch_id: body.branch_id || null,
        actor_user_id: auth.user.id,
        event_type: String(body.event_type || 'security_event').trim().slice(0, 80),
        action: String(body.action_name || body.action || 'unknown').trim().slice(0, 120),
        resource: String(body.resource || 'unknown').trim().slice(0, 160),
        result: String(body.result || 'SUCCESS').toUpperCase().trim().slice(0, 30),
        metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {}
      };

      const { data, error } = await admin
        .from('hfms_security_events')
        .insert(row)
        .select()
        .single();

      if (error) return json(400, { error: error.message });
      return json(200, { event: data });
    }

    // ACTION: Run Security Smoke Test
    if (action === 'run_smoke_test') {
      const checks = [];
      
      // Identity & Auth Verification
      checks.push({
        control: 'authenticated_identity',
        status: auth.user?.id ? 'PASS' : 'FAIL'
      });

      checks.push({
        control: 'head_office_authorization',
        status: access.isHeadOffice ? 'PASS' : 'FAIL'
      });

      checks.push({
        control: 'role_matrix_loaded',
        status: grantsList.length > 0 ? 'PASS' : 'WARN',
        detail: `${grantsList.length} access grant(s) loaded`
      });

      // DB Plane Verification
      const requiredTables = [
        'audit_log',
        'user_branch_access',
        'financial_transactions',
        'journal_entries',
        'hfms_notification_queue',
        'hfms_security_events'
      ];

      for (const table of requiredTables) {
        const { error, count } = await admin
          .from(table)
          .select('*', { count: 'exact', head: true })
          .limit(1);

        checks.push({
          control: `data_plane:${table}`,
          status: error ? 'FAIL' : 'PASS',
          detail: error ? error.message : `Table accessible (${count ?? 0} records)`
        });
      }

      const passed = checks.filter(c => c.status === 'PASS').length;
      const score = Math.round((passed / checks.length) * 100);
      const overallResult = score === 100 ? 'PASS' : 'REVIEW';

      // Audit smoke test execution
      await admin.from('hfms_security_events').insert({
        actor_user_id: auth.user.id,
        event_type: 'security_smoke_test',
        action: 'run_smoke_test',
        resource: 'HFMS_SECURITY_CENTER',
        result: overallResult,
        metadata: { checks, score }
      });

      return json(200, {
        score,
        checks,
        generated_at: new Date().toISOString()
      });
    }

    return json(400, { error: `Unknown security action: '${action}'.` });

  } catch (e) {
    console.error('[HFMS Security Center Error]:', e);
    return json(500, { error: 'Security center service unavailable.' });
  }
};