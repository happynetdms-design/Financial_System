const { requireUser, json } = require('./_lib/supabase');
const { getAccess } = require('./_lib/rbac');

const REQUIRED_TABLES = [
  'financial_transactions',
  'journal_entries',
  'audit_log',
  'user_branch_access',
  'branches',
  'allocations',
  'cash_reconciliations',
  'reconciliation_import_rows',
  'hfms_security_events'
];

const REQUIRED_FUNCTIONS = [
  'revenue.js', 'expenses.js', 'import-financials.js', 'loans.js',
  'profit-first-control.js', 'reconciliation-center.js',
  'financial-statements-enterprise.js', 'tax-intelligence.js',
  'executive-management.js', 'automation-center.js', 'automation-runner.js',
  'ai-cfo.js', 'security-center.js'
];

exports.handler = async event => {
  const auth = await requireUser(event);
  if (auth.error) return json(401, { error: auth.error });
  try {
    const access = await getAccess(auth.admin, auth.user.id);
    if (!access.isHeadOffice) return json(403, { error: 'Head Office access required.' });

    const tables = [];
    for (const table of REQUIRED_TABLES) {
      const { error } = await auth.admin.from(table).select('*', { head: true, count: 'exact' }).limit(1);
      tables.push({ table, status: error ? 'FAIL' : 'PASS', detail: error?.message || 'reachable' });
    }

    const fs = require('fs');
    const path = require('path');
    const functionsDir = path.join(__dirname);
    const functions = REQUIRED_FUNCTIONS.map(file => ({
      function: file,
      status: fs.existsSync(path.join(functionsDir, file)) ? 'PASS' : 'FAIL'
    }));

    const environment = ['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'].map(key => ({
      key, configured: Boolean(process.env[key])
    }));

    const checks = [
      ...tables,
      ...functions,
      ...environment.map(x => ({ ...x, status: x.configured ? 'PASS' : 'FAIL' }))
    ];
    const passed = checks.filter(x => x.status === 'PASS').length;
    const score = checks.length ? Math.round((passed / checks.length) * 100) : 0;

    await auth.admin.from('hfms_security_events').insert({
      actor_user_id: auth.user.id,
      event_type: 'system_health_check',
      action: 'run_system_health',
      resource: 'HFMS',
      result: score === 100 ? 'PASS' : 'REVIEW',
      metadata: { score, checks }
    });

    return json(200, {
      generated_at: new Date().toISOString(),
      score,
      checks,
      tables,
      functions,
      environment: environment.map(x => ({ key: x.key, configured: x.configured }))
    });
  } catch (error) {
    console.error('system-health', error);
    return json(500, { error: 'System health check unavailable.' });
  }
};
