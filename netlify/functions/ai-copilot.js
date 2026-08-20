const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');

const MODEL = process.env.HFMS_AI_MODEL || 'claude-3-5-sonnet-20241022';

function money(v) { return Number(v || 0); }

function cleanHistory(history) {
  return (Array.isArray(history) ? history : [])
    .filter(x => x && (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string')
    .slice(-10);
}

async function context(admin, branchId) {
  const [{ data: tx }, { data: accounts }, { data: alloc }, { data: alerts }, { data: budgets }, { data: loans }] = await Promise.all([
    admin.from('financial_transactions').select('id,transaction_date,transaction_type,direction,net_amount_kes,category_id,counterparty,description,source_system,source_reference').eq('branch_id', branchId).eq('is_deleted', false).eq('classification_status', 'classified').order('transaction_date', { ascending: false }).limit(2500),
    admin.from('chart_of_accounts').select('id,code,name,account_type,is_active').eq('branch_id', branchId).eq('is_active', true).order('code'),
    admin.from('profit_first_allocations').select('*').eq('branch_id', branchId).order('created_at', { ascending: false }).limit(100),
    admin.from('financial_alerts').select('alert_type,severity,title,message,status,created_at').eq('branch_id', branchId).order('created_at', { ascending: false }).limit(50),
    admin.from('budgets').select('*').eq('branch_id', branchId).order('period_start', { ascending: false }).limit(100),
    admin.from('loans').select('id,debt_name,lender,current_balance_kes,min_monthly_payment_kes,status').eq('branch_id', branchId).eq('is_deleted', false)
  ]);

  let revenue = 0, expenses = 0, funding = 0, repayments = 0;
  const byMonth = {};
  const byCategory = {};

  for (const r of tx || []) {
    const a = money(r.net_amount_kes), m = (r.transaction_date || '').slice(0, 7);
    byMonth[m] ??= { revenue: 0, expenses: 0, funding: 0, repayments: 0 };

    if (r.transaction_type === 'revenue') { revenue += a; byMonth[m].revenue += a; }
    else if (r.transaction_type === 'expense') { expenses += a; byMonth[m].expenses += a; const c = r.category_id || 'uncategorized'; byCategory[c] = (byCategory[c] || 0) + a; }
    else if (r.transaction_type === 'owner_loan_funding') { funding += a; byMonth[m].funding += a; }
    else if (r.transaction_type === 'owner_loan_repayment') { repayments += a; byMonth[m].repayments += a; }
  }

  return {
    as_of: new Date().toISOString(),
    branch_id: branchId,
    ledger: { revenue, expenses, operating_result: revenue - expenses, owner_loan_funding: funding, owner_loan_repayment: repayments, net_financing_adjusted_cash: revenue + funding - expenses - repayments, transaction_count: (tx || []).length },
    monthly: byMonth,
    expense_categories: byCategory,
    accounts: accounts || [],
    allocations: alloc || [],
    alerts: alerts || [],
    budgets: budgets || [],
    loans: loans || [],
    recent_transactions: (tx || []).slice(0, 100)
  };
}

const SYSTEM = `You are HFMS Copilot, Happynet's senior financial-management AI.
You are not a generic chatbot. You operate as a finance analyst, management-report writer, Profit First coach, accounting workflow assistant, and software copilot.

CORE ACCOUNTING RULES:
- Organization Utility completed settlements are Happynet revenue.
- Tende outgoing transactions are expenses (including applicable Tende charges).
- Tende incoming funds identified as John/owner funding are owner/director loans, NEVER revenue.
- Owner loan repayments reduce the liability; they are not operating expenses.
- Profit First is the governing cash-management philosophy. Never recommend treating allocated envelopes as ordinary available cash.
- Never invent a number. Every financial number must be traceable to supplied context.
- Separate FACT, CALCULATION, FORECAST, RECOMMENDATION, and RISK.
- Forecasts must state assumptions and uncertainty.
- Tax/legal conclusions must be flagged for professional confirmation.

INTERACTIVE BEHAVIOUR:
- You may propose actions: create a draft journal, draft a report, prepare an allocation, create a budget, create a recurring expense, flag an anomaly, or prepare a reconciliation.
- Never execute a money-moving or ledger-mutating action merely because the user asked in natural language. Create a pending action requiring explicit confirmation.
- High-risk actions (posting/reversing journals, recording transfers, closing periods, changing Profit First percentages, approving allocations, deleting/voiding records) always require explicit confirmation and appropriate RBAC.
- You can generate management reports and explanations immediately because they are read-only.
- When the user asks what to do, give a prioritized recommendation with evidence.
- When the user asks for a report, return a management-ready structure with title, period, executive summary, KPIs, findings, risks, recommendations, and data notes.

STYLE:
Professional CFO/controller tone. Clear, concise, decisive. Use KES. Do not pretend to be human or claim to have completed an action unless the tool result confirms it.`;

function extractText(data) {
  return (data.content || []).filter(x => x.type === 'text').map(x => x.text).join('\n');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });

  const admin = adminClient();
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON.' });
  }

  const { branch_id: branchId, question, history = [], mode = 'auto' } = body;
  if (!branchId || !question?.trim()) return json(400, { error: 'branch_id and question are required.' });

  const ctx = await requireBranchAccess(event, requireUser, admin, branchId, { write: false });
  if (ctx.error) return json(ctx.status, { error: ctx.error });

  if (!process.env.ANTHROPIC_API_KEY) return json(500, { error: 'ANTHROPIC_API_KEY is not configured.' });

  try {
    const financial = await context(admin, branchId);
    let sanitizedHistory = cleanHistory(history);

    if (sanitizedHistory.length > 0 && sanitizedHistory[sanitizedHistory.length - 1].role === 'user') {
      sanitizedHistory.pop();
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1800,
        temperature: 0.1,
        system: [
          {
            type: 'text',
            text: SYSTEM,
            cache_control: { type: 'ephemeral' }
          },
          {
            type: 'text',
            text: `LIVE HFMS FINANCIAL CONTEXT:\n${JSON.stringify(financial)}`,
            cache_control: { type: 'ephemeral' }
          }
        ],
        messages: [
          ...sanitizedHistory,
          {
            role: 'user',
            content: `USER REQUEST:\n${question}\n\nMODE: ${mode}\nReturn a structured answer. If an action is appropriate, include a final ACTION block in JSON on one line: {"action_type":"...","risk_level":"low|medium|high|critical","payload":{...},"confirmation_text":"..."}. Do not claim execution.`
          }
        ]
      })
    });

    if (!res.ok) {
      console.error(await res.text());
      return json(502, { error: 'AI provider unavailable.' });
    }

    const data = await res.json();
    const answer = extractText(data);

    let proposed_action = null;
    const match = answer.match(/ACTION\s*:\s*(\{[\s\S]*\})\s*$/i);
    if (match) {
      try {
        proposed_action = JSON.parse(match[1]);
      } catch {}
    }

    if (proposed_action) {
      const { data: ar, error } = await admin
        .from('ai_action_requests')
        .insert({
          branch_id: branchId,
          user_id: ctx.user.id,
          action_type: proposed_action.action_type,
          action_payload: proposed_action.payload || {},
          risk_level: proposed_action.risk_level || 'medium',
          status: 'awaiting_confirmation',
          confirmation_text: proposed_action.confirmation_text || 'Confirm this action.'
        })
        .select()
        .single();

      if (error) console.error('action insert error:', error);
      else proposed_action = { ...proposed_action, id: ar.id, status: 'awaiting_confirmation' };
    }

    return json(200, { answer, proposed_action, as_of: financial.as_of });

  } catch (e) {
    console.error('[ai-copilot error]:', e);
    return json(500, { error: e.message || 'Unexpected AI copilot error.' });
  }
};