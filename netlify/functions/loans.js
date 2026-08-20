const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');

exports.handler = async (event) => {
  const method = event.httpMethod;

  // 1. Handle CORS Preflight Requests Immediately
  if (method === 'OPTIONS') {
    return json(200, { ok: true });
  }

  // 2. Environment Variables Verification Check
  if (!process.env.SUPABASE_URL || (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_ANON_KEY)) {
    return json(500, {
      status: 'not configured',
      error: 'Missing required Supabase environment variables on server.'
    });
  }

  // 3. System Health Probe / Ping Diagnostic
  const isHealthCheck = event.queryStringParameters && (event.queryStringParameters.health === 'true' || event.queryStringParameters.probe === '1');
  if (isHealthCheck) {
    return json(200, {
      status: 'configured',
      module: 'loans.js',
      reachable: true
    });
  }

  // Initialize Supabase Admin Client
  let admin;
  try {
    admin = adminClient();
  } catch (err) {
    return json(500, { status: 'not configured', error: err.message });
  }

  // Parse HTTP Body
  let body = {};
  if (method !== 'GET') {
    try { 
      body = JSON.parse(event.body || '{}'); 
    } catch (e) { 
      return json(400, { error: 'Invalid JSON body.' }); 
    }
  }

  // Extract Branch ID
  const branchId = method === 'GET'
    ? (event.queryStringParameters || {}).branch_id
    : body.branch_id;

  // Allow System Auditor to Bypass RBAC if explicitly probing module health without a branch_id
  if (!branchId && event.queryStringParameters && event.queryStringParameters.probe === '1') {
    return json(200, { status: 'configured', module: 'loans.js' });
  }

  // Enforce Access Control (RBAC)
  const ctx = await requireBranchAccess(event, requireUser, admin, branchId, { write: method !== 'GET' });
  if (ctx.error) return json(ctx.status, { error: ctx.error });

  try {
    if (method === 'GET') {
      // loan_payments are fetched separately via /api/loan-payments — kept
      // as its own array client-side, same shape as before.
      const { data, error } = await admin
        .from('loans').select('*')
        .eq('branch_id', branchId).eq('is_deleted', false)
        .order('created_at', { ascending: false });
      if (error) return json(500, { error: error.message });
      return json(200, { loans: data });
    }

    if (method === 'POST') {
      if (!body.debt_name || body.original_principal_kes === undefined) {
        return json(400, { error: 'debt_name and original_principal_kes are required.' });
      }
      const payload = {
        ...(body.id ? { id: body.id } : {}),
        branch_id: branchId,
        debt_name: body.debt_name,
        lender: body.lender || null,
        original_principal_kes: body.original_principal_kes,
        current_balance_kes: body.current_balance_kes !== undefined ? body.current_balance_kes : body.original_principal_kes,
        annual_interest_rate_pct: body.annual_interest_rate_pct || 0,
        start_date: body.start_date || null,
        min_monthly_payment_kes: body.min_monthly_payment_kes || 0,
        status: body.status || 'ACTIVE'
      };
      const { data, error } = await admin.from('loans').insert(payload).select().maybeSingle();
      if (error) return json(500, { error: error.message });
      return json(201, { loan: data });
    }

    if (method === 'PATCH') {
      if (!body.id) return json(400, { error: 'id is required.' });
      const updatable = ['debt_name', 'lender', 'original_principal_kes', 'current_balance_kes',
        'annual_interest_rate_pct', 'start_date', 'min_monthly_payment_kes', 'status'];
      const patch = {};
      for (const k of updatable) if (body[k] !== undefined) patch[k] = body[k];
      const { data, error } = await admin
        .from('loans').update(patch)
        .eq('id', body.id).eq('branch_id', branchId)
        .select().maybeSingle();
      if (error) return json(500, { error: error.message });
      if (!data) return json(404, { error: 'Loan not found on this branch.' });
      return json(200, { loan: data });
    }

    if (method === 'DELETE') {
      if (!body.id) return json(400, { error: 'id is required.' });
      const { data, error } = await admin
        .from('loans').update({ is_deleted: true })
        .eq('id', body.id).eq('branch_id', branchId)
        .select().maybeSingle();
      if (error) return json(500, { error: error.message });
      if (!data) return json(404, { error: 'Loan not found on this branch.' });
      return json(200, { ok: true });
    }

    return json(405, { error: 'Method not allowed.' });
  } catch (e) {
    console.error('loans error', e);
    return json(500, { error: 'Unexpected error handling loans.' });
  }
};