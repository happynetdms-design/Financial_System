const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');

function allowedRole(role, action) {
  const high = [
    'post_journal',
    'reverse_journal',
    'record_profit_first_transfer',
    'close_period',
    'change_profit_first_settings',
    'approve_allocation'
  ];
  if (high.includes(action)) return ['owner', 'finance_manager', 'accountant'].includes(role);
  return ['owner', 'finance_manager', 'accountant', 'branch_manager'].includes(role);
}

exports.handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });

  const admin = adminClient();
  let b;
  try {
    b = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON.' });
  }

  const { branch_id: branchId, action_id: actionId, confirm = false } = b;
  if (!branchId || !actionId) {
    return json(400, { error: 'branch_id and action_id are required.' });
  }

  const auth = await requireUser(event);
  if (auth.error) return json(401, { error: auth.error });

  try {
    const { data: action, error } = await admin
      .from('ai_action_requests')
      .select('*')
      .eq('id', actionId)
      .eq('branch_id', branchId)
      .maybeSingle();

    if (error || !action) return json(404, { error: 'Action request not found.' });
    if (action.status !== 'awaiting_confirmation') return json(409, { error: `Action is ${action.status}.` });

    const access = await requireBranchAccess(event, requireUser, admin, branchId, { write: true });
    if (access.error) return json(access.status, { error: access.error });

    const role = (access.role || access.user_role || '').toLowerCase();
    if (!allowedRole(role, action.action_type)) {
      return json(403, { error: 'Your role is not authorized to execute this AI-proposed action.' });
    }

    if (!confirm) {
      await admin.from('ai_action_requests').update({ status: 'cancelled' }).eq('id', actionId);
      
      // Audit cancellation
      await admin.from('hfms_security_events').insert({
        branch_id: branchId,
        actor_user_id: access.user.id,
        event_type: 'ai_action_cancelled',
        action: action.action_type,
        resource: 'ai_action_requests',
        result: 'CANCELLED',
        metadata: { action_id: actionId }
      });

      return json(200, { status: 'cancelled' });
    }

    let result = { status: 'confirmed', action_type: action.action_type };

    if (action.action_type === 'create_financial_recommendation') {
      const p = action.action_payload || {};
      const { data: r, error: e } = await admin
        .from('financial_recommendations')
        .insert({
          branch_id: branchId,
          created_by: access.user.id,
          recommendation_type: p.type || 'ai',
          title: p.title || 'AI Recommendation',
          evidence: p.evidence || {},
          recommendation: p.recommendation || '',
          expected_impact: p.expected_impact || {}
        })
        .select()
        .single();

      if (e) throw e;
      result = { ...result, recommendation_id: r.id };

    } else if (action.action_type === 'create_report') {
      result = { ...result, report: action.action_payload || {} };

    } else if (action.action_type === 'create_draft_journal') {
      const p = action.action_payload || {};
      const { data: j, error: e } = await admin
        .from('journal_entries')
        .insert({
          branch_id: branchId,
          created_by: access.user.id,
          entry_date: p.entry_date || new Date().toISOString().slice(0, 10),
          description: p.description || 'AI Proposed Draft Journal',
          status: 'draft',
          amount_kes: p.amount_kes || 0
        })
        .select()
        .single();

      if (e) throw e;
      result = { ...result, requires_manual_post: true, journal_id: j.id, draft: p };

    } else {
      return json(422, {
        error: 'This AI action requires the dedicated financial control workflow. No ledger mutation was performed.'
      });
    }

    // Update Request State
    await admin
      .from('ai_action_requests')
      .update({
        status: 'executed',
        confirmed_at: new Date().toISOString(),
        executed_at: new Date().toISOString(),
        execution_result: result
      })
      .eq('id', actionId);

    // Write Security Audit Log
    await admin.from('hfms_security_events').insert({
      branch_id: branchId,
      actor_user_id: access.user.id,
      event_type: 'ai_action_executed',
      action: action.action_type,
      resource: 'ai_action_requests',
      result: 'SUCCESS',
      metadata: { action_id: actionId, result }
    });

    return json(200, result);

  } catch (e) {
    console.error('[ai-action error]:', e);
    return json(500, { error: e.message || 'Failed to process action request.' });
  }
};