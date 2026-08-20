const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');

const n = v => Number(v || 0);
const dayKey = d => String(d || '').slice(0, 10);
const monthKey = d => String(d || '').slice(0, 7);
const pct = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : null);

async function context(event, branchId, write = false) {
  return requireBranchAccess(event, requireUser, adminClient(), branchId, { write });
}

function buildMetrics(tx, cashRows, loans, allocations, budgets, targets) {
  let revenue = 0;
  let expenses = 0;
  let ownerFunding = 0;
  let ownerRepayments = 0;

  const months = {};

  for (const r of tx || []) {
    const a = n(r.net_amount_kes);
    const m = monthKey(r.transaction_date);

    if (!months[m]) months[m] = { revenue: 0, expenses: 0, net_cash: 0 };

    if (r.transaction_type === 'revenue' && r.direction === 'in') {
      revenue += a;
      months[m].revenue += a;
      months[m].net_cash += a;
    }
    if (r.transaction_type === 'expense' && r.direction === 'out') {
      expenses += a;
      months[m].expenses += a;
      months[m].net_cash -= a;
    }
    if (r.transaction_type === 'owner_loan_funding' && r.direction === 'in') {
      ownerFunding += a;
      months[m].net_cash += a;
    }
    if (r.transaction_type === 'owner_loan_repayment' && r.direction === 'out') {
      ownerRepayments += a;
      months[m].net_cash -= a;
    }
  }

  const keys = Object.keys(months).sort();
  const recent = keys.slice(-3);
  const prior = keys.slice(-6, -3);

  const avg = (ks, k) => (ks.length ? ks.reduce((s, m) => s + n(months[m]?.[k]), 0) / ks.length : 0);

  const recentRev = avg(recent, 'revenue');
  const priorRev = avg(prior, 'revenue');
  const recentExp = avg(recent, 'expenses');

  const balances = {};
  for (const r of cashRows || []) {
    balances[r.account_id] = (balances[r.account_id] || 0) + (r.direction === 'outflow' ? -n(r.amount_kes) : n(r.amount_kes));
  }

  const cash = Object.values(balances).reduce((s, v) => s + v, 0);
  const burn = Math.max(recentExp - recentRev, 0);
  const runway = burn ? cash / burn : null;
  const loanBalance = (loans || []).reduce((s, l) => s + n(l.current_balance_kes), 0);

  const openAlloc = (allocations || []).filter(a => !['closed', 'verified'].includes(String(a.status || '').toLowerCase()));
  const allocTotal = openAlloc.reduce((s, a) => s + n(a.expected_amount_kes || a.amount_kes), 0);
  const budgetVariance = (budgets || []).reduce((s, b) => s + (n(b.amount_kes || b.budget_amount_kes) - n(b.actual_amount_kes || b.actual_kes)), 0);

  const targetMap = {};
  for (const t of targets || []) targetMap[t.metric_key] = t;

  const health = [];
  if (recentRev > 0 && recentExp / recentRev >= 0.9) {
    health.push({
      severity: 'high',
      code: 'margin_pressure',
      message: 'Recent operating expenses are consuming 90% or more of revenue.'
    });
  }

  if (runway !== null && runway < 1) {
    health.push({
      severity: 'critical',
      code: 'cash_pressure',
      message: 'Cash runway is below one month at the recent operating burn rate.'
    });
  } else if (runway !== null && runway < 3) {
    health.push({
      severity: 'medium',
      code: 'cash_watch',
      message: 'Cash runway is below three months at the recent operating burn rate.'
    });
  }

  if (openAlloc.length) {
    health.push({
      severity: 'medium',
      code: 'profit_first_open',
      message: `${openAlloc.length} Profit First allocation cycle(s) still require completion.`
    });
  }

  if (budgetVariance < 0) {
    health.push({
      severity: 'medium',
      code: 'budget_pressure',
      message: 'One or more budget lines are currently over plan.'
    });
  }

  return {
    revenue,
    expenses,
    operating_result: revenue - expenses,
    owner_funding: ownerFunding,
    owner_repayments: ownerRepayments,
    owner_loan_balance: loanBalance,
    cash_balance: cash,
    cash_runway_months: runway,
    recent_revenue_growth_pct: pct(recentRev, priorRev),
    recent_avg_revenue: recentRev,
    recent_avg_expenses: recentExp,
    open_profit_first_allocations: openAlloc.length,
    open_profit_first_amount: allocTotal,
    budget_variance: budgetVariance,
    health,
    monthly: keys.slice(-12).map(k => ({ month: k, ...months[k] })),
    targets: targetMap
  };
}

exports.handler = async event => {
  const q = event.queryStringParameters || {};
  const branchId = q.branch_id;

  if (!branchId) return json(400, { error: 'branch_id is required.' });

  const admin = adminClient();
  const method = event.httpMethod || 'GET';

  try {
    const ctx = await context(event, branchId, method !== 'GET');
    if (ctx.error) return json(ctx.status, { error: ctx.error });

    const { data: user } = await requireUser(event);

    // GET Request: Executive Dashboard & Metrics Data
    if (method === 'GET') {
      const [txR, cashR, loanR, allocR, budgetR, targetR, decisionR, briefR] = await Promise.all([
        admin
          .from('financial_transactions')
          .select('transaction_date,transaction_type,direction,net_amount_kes,classification_status')
          .eq('branch_id', branchId)
          .eq('is_deleted', false)
          .eq('classification_status', 'classified')
          .order('transaction_date', { ascending: false })
          .limit(20000),
        admin
          .from('cash_movements')
          .select('account_id,direction,amount_kes')
          .eq('branch_id', branchId)
          .eq('is_deleted', false)
          .limit(20000),
        admin
          .from('loans')
          .select('current_balance_kes')
          .eq('branch_id', branchId)
          .eq('is_deleted', false),
        admin
          .from('profit_first_allocations')
          .select('*')
          .eq('branch_id', branchId)
          .order('period', { ascending: false })
          .limit(200),
        admin
          .from('budgets')
          .select('*')
          .eq('branch_id', branchId)
          .order('period_start', { ascending: false })
          .limit(200),
        admin
          .from('hfms_executive_kpi_targets')
          .select('*')
          .eq('branch_id', branchId)
          .eq('status', 'active')
          .order('period_end', { ascending: false }),
        admin
          .from('hfms_executive_decisions')
          .select('*')
          .eq('branch_id', branchId)
          .in('status', ['open', 'in_progress'])
          .order('priority', { ascending: false })
          .order('due_date', { ascending: true })
          .limit(100),
        admin
          .from('hfms_executive_briefings')
          .select('*')
          .eq('branch_id', branchId)
          .order('period_end', { ascending: false })
          .limit(12)
      ]);

      for (const r of [txR, cashR, loanR, allocR, budgetR, targetR, decisionR, briefR]) {
        if (r.error) throw r.error;
      }

      const metrics = buildMetrics(txR.data, cashR.data, loanR.data, allocR.data, budgetR.data, targetR.data);
      const priorities = [...metrics.health];
      const now = dayKey(new Date().toISOString());

      for (const d of decisionR.data || []) {
        if (d.due_date && d.due_date < now) {
          priorities.push({
            severity: 'high',
            code: 'decision_overdue',
            message: `Decision overdue: ${d.title}`
          });
        }
      }

      return json(200, {
        as_of: new Date().toISOString(),
        branch_id: branchId,
        metrics,
        decisions: decisionR.data || [],
        briefings: briefR.data || [],
        priorities
      });
    }

    // POST Request Actions
    if (method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const action = body.action;

      // Action: Create Decision
      if (action === 'create_decision') {
        const allowedRoles = ['owner', 'finance_manager', 'accountant', 'branch_manager'];
        if (!allowedRoles.includes(ctx.role) && !ctx.isHeadOffice) {
          return json(403, { error: 'Insufficient approval rights.' });
        }

        const row = {
          branch_id: branchId,
          title: String(body.title || '').trim(),
          priority: body.priority || 'medium',
          source: body.source || 'executive',
          description: body.description || null,
          recommended_action: body.recommended_action || null,
          due_date: body.due_date || null,
          owner_user_id: body.owner_user_id || null,
          created_by: user?.id || null
        };

        if (!row.title) return json(400, { error: 'Decision title is required.' });

        const { data, error } = await admin
          .from('hfms_executive_decisions')
          .insert(row)
          .select('*')
          .single();

        if (error) throw error;
        return json(201, { decision: data });
      }

      // Action: Update Decision
      if (action === 'update_decision') {
        const id = body.id;
        if (!id) return json(400, { error: 'Decision id is required.' });

        const patch = {};
        const allowedKeys = ['status', 'priority', 'description', 'recommended_action', 'due_date', 'owner_user_id'];
        allowedKeys.forEach(k => {
          if (body[k] !== undefined) patch[k] = body[k];
        });
        patch.updated_at = new Date().toISOString();

        const { data, error } = await admin
          .from('hfms_executive_decisions')
          .update(patch)
          .eq('id', id)
          .eq('branch_id', branchId)
          .select('*')
          .single();

        if (error) throw error;
        return json(200, { decision: data });
      }

      // Action: Set KPI Target
      if (action === 'set_target') {
        const metric = String(body.metric_key || '').trim();
        const value = n(body.target_value);

        if (!metric || !body.period_start || !body.period_end) {
          return json(400, { error: 'Metric, period start and period end are required.' });
        }

        await admin
          .from('hfms_executive_kpi_targets')
          .update({ status: 'archived', updated_at: new Date().toISOString() })
          .eq('branch_id', branchId)
          .eq('metric_key', metric)
          .eq('status', 'active');

        const { data, error } = await admin
          .from('hfms_executive_kpi_targets')
          .insert({
            branch_id: branchId,
            metric_key: metric,
            target_value: value,
            period_start: body.period_start,
            period_end: body.period_end,
            created_by: user?.id || null
          })
          .select('*')
          .single();

        if (error) throw error;
        return json(201, { target: data });
      }

      // Action: Save Executive Briefing
      if (action === 'save_briefing') {
        const { data, error } = await admin
          .from('hfms_executive_briefings')
          .insert({
            branch_id: branchId,
            period_start: body.period_start,
            period_end: body.period_end,
            briefing_type: body.briefing_type || 'executive',
            headline: body.headline || null,
            facts: body.facts || {},
            risks: body.risks || [],
            priorities: body.priorities || [],
            recommendations: body.recommendations || [],
            created_by: user?.id || null
          })
          .select('*')
          .single();

        if (error) throw error;
        return json(201, { briefing: data });
      }

      return json(400, { error: 'Unknown executive action.' });
    }

    return json(405, { error: 'Method not allowed.' });
  } catch (e) {
    console.error(e);
    return json(500, { error: e.message || 'Executive management request failed.' });
  }
};