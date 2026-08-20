const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');

exports.handler = async event => {
  const auth = await requireUser(event);
  if (auth.error) {
    return json(401, { error: auth.error });
  }

  const admin = adminClient();
  let body = {};

  if (event.httpMethod === 'POST') {
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return json(400, { error: 'Invalid JSON' });
    }
  }

  const branchId = body.branch_id || event.queryStringParameters?.branch_id;
  if (!branchId) {
    return json(400, { error: 'branch_id is required.' });
  }

  const ctx = await requireBranchAccess(
    event,
    requireUser,
    admin,
    branchId,
    { write: event.httpMethod === 'POST' }
  );

  if (ctx.error) {
    return json(ctx.status, { error: ctx.error });
  }

  try {
    // GET Request: Fetch rules, queue, runs, and events
    if (event.httpMethod === 'GET') {
      const [rules, queue, runs, events] = await Promise.all([
        admin
          .from('hfms_automation_rules')
          .select('*')
          .eq('branch_id', branchId)
          .order('rule_key'),
        admin
          .from('hfms_notification_queue')
          .select('id,rule_key,channel,subject,status,attempts,last_error,created_at,sent_at')
          .eq('branch_id', branchId)
          .order('created_at', { ascending: false })
          .limit(50),
        admin
          .from('hfms_automation_runs')
          .select('id,trigger,status,started_at,finished_at,notifications_created,notifications_sent,actions_prepared,actions_executed,summary,error_message')
          .order('started_at', { ascending: false })
          .limit(20),
        admin
          .from('hfms_automation_events')
          .select('*')
          .eq('branch_id', branchId)
          .order('created_at', { ascending: false })
          .limit(50)
      ]);

      return json(200, {
        rules: rules.data || [],
        queue: queue.data || [],
        runs: runs.data || [],
        events: events.data || []
      });
    }

    // POST Request Actions
    if (event.httpMethod === 'POST') {
      const action = body.action;

      // Action: Trigger Automation Runner
      if (action === 'run') {
        const resp = await fetch(`${process.env.URL || ''}/.netlify/functions/automation-runner`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(event.headers.authorization ? { Authorization: event.headers.authorization } : {})
          },
          body: JSON.stringify({ branch_id: branchId })
        });

        return json(resp.status, await resp.json());
      }

      // Action: Update Automation Rule
      if (action === 'update_rule') {
        const isHeadOffice = ctx.access?.isHeadOffice;
        const userRole = String(ctx.role || '');
        const allowedRoles = ['owner', 'finance_manager', 'branch_manager'];

        if (!ctx.user || (!isHeadOffice && !allowedRoles.includes(userRole))) {
          return json(403, { error: 'Management permission required.' });
        }

        const { rule_key, enabled, channel, lead_days, threshold_kes, auto_execute } = body;
        if (!rule_key) {
          return json(400, { error: 'rule_key is required.' });
        }

        const patch = {
          updated_by: ctx.user.id,
          updated_at: new Date().toISOString()
        };

        if (enabled !== undefined) patch.enabled = !!enabled;
        if (channel) patch.channel = channel;
        if (lead_days !== undefined) patch.lead_days = Math.max(0, Number(lead_days) || 0);
        if (threshold_kes !== undefined) patch.threshold_kes = Number(threshold_kes) || 0;
        if (auto_execute !== undefined) patch.auto_execute = !!auto_execute;

        const r = await admin
          .from('hfms_automation_rules')
          .update(patch)
          .eq('branch_id', branchId)
          .eq('rule_key', rule_key)
          .select()
          .single();

        if (r.error) {
          return json(400, { error: r.error.message });
        }

        return json(200, { rule: r.data });
      }

      return json(400, { error: 'Unknown action.' });
    }

    return json(405, { error: 'GET or POST only' });
  } catch (e) {
    return json(500, { error: e.message });
  }
};