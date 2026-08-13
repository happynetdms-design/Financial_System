// AI Financial Assistant. This does NOT let the model free-associate about
// Happynet's finances — every number it can reference is pulled from the
// database right here, packaged into a compact JSON summary, and handed to
// the model with an explicit instruction to answer only from that data and
// to label anything forward-looking as a prediction, not a fact. If a
// question can't be answered from the summary, the model is told to say so
// rather than guess.
const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');

const MODEL = 'claude-sonnet-5';
const MAX_HISTORY_TURNS = 6; // keep the request small; this endpoint is stateless server-side

function monthKey(dateStr){ return (dateStr || '').slice(0, 7); }

async function buildFinancialSummary(admin, branchId){
  const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth()-6);
  const cutoff=sixMonthsAgo.toISOString().slice(0,10);
  const [{data:tx},{data:loans},{data:taxObligations},{data:settings},{data:alerts}]=await Promise.all([
    admin.from('financial_transactions').select('transaction_date,transaction_type,direction,net_amount_kes,category_id,counterparty,description,source_system').eq('branch_id',branchId).eq('is_deleted',false).eq('classification_status','classified').gte('transaction_date',cutoff),
    admin.from('loans').select('debt_name,lender,current_balance_kes,min_monthly_payment_kes,status').eq('branch_id',branchId).eq('is_deleted',false),
    admin.from('tax_obligations').select('tax_type,applicable,frequency,manual_next_due_date,estimated_amount_kes').eq('branch_id',branchId),
    admin.from('profit_first_settings').select('*').eq('branch_id',branchId).maybeSingle(),
    admin.from('financial_alerts').select('alert_type,severity,title,message,status,created_at').eq('branch_id',branchId).eq('status','open').order('created_at',{ascending:false}).limit(20)
  ]);
  const monthly={}; const expenseByCategory={}; let revenue=0,expenses=0,ownerLoanFunding=0,ownerLoanRepayment=0;
  for(const r of tx||[]){const a=Number(r.net_amount_kes||0);const m=(r.transaction_date||'').slice(0,7);monthly[m]??={revenue:0,expenses:0,owner_loan_funding:0,owner_loan_repayment:0}; if(r.transaction_type==='revenue'){revenue+=a;monthly[m].revenue+=a;} if(r.transaction_type==='expense'){expenses+=a;monthly[m].expenses+=a;const cat=r.category_id||'uncategorized';expenseByCategory[cat]=(expenseByCategory[cat]||0)+a;} if(r.transaction_type==='owner_loan_funding'){ownerLoanFunding+=a;monthly[m].owner_loan_funding+=a;} if(r.transaction_type==='owner_loan_repayment'){ownerLoanRepayment+=a;monthly[m].owner_loan_repayment+=a;}}
  return {as_of:new Date().toISOString().slice(0,10),period_covered:`${cutoff} to today`,ledger:{revenue_kes:revenue,expenses_kes:expenses,net_profit_kes:revenue-expenses,owner_loan_funding_kes:ownerLoanFunding,owner_loan_repayment_kes:ownerLoanRepayment,net_cash_movement_kes:revenue+ownerLoanFunding-expenses-ownerLoanRepayment,transaction_count:(tx||[]).length},monthly,expenses_by_category_kes:expenseByCategory,loans:(loans||[]).map(l=>({name:l.debt_name,lender:l.lender,balance_kes:Number(l.current_balance_kes),min_monthly_payment_kes:Number(l.min_monthly_payment_kes),status:l.status})),tax_obligations:(taxObligations||[]).filter(t=>t.applicable).map(t=>({type:t.tax_type,frequency:t.frequency,next_due:t.manual_next_due_date,estimated_kes:Number(t.estimated_amount_kes)})),open_alerts:alerts||[],profit_first_settings:settings?{profit_pct:Number(settings.pct_profit),owner_pay_debt_pct:Number(settings.pct_owner_debt),tax_pct:Number(settings.pct_tax),opex_pct:Number(settings.pct_opex),monthly_revenue_target_kes:Number(settings.monthly_revenue_target_kes)}:null};
}
const SYSTEM_PROMPT = `You are Happynet's financial assistant, built on top of its Profit First dashboard.

Rules you must follow:
1. Answer ONLY using the JSON financial summary provided in each message. Never invent, estimate, or assume a number that isn't in that data.
2. If the summary doesn't contain what's needed to answer, say so plainly and explain what data would be needed — do not guess.
3. Clearly separate facts (numbers straight from the data) from predictions or recommendations (label these explicitly, e.g. "Prediction:" or "Recommendation:").
4. Keep answers concise and concrete — use actual KES figures from the data, not vague language.
5. You are not a licensed accountant or financial advisor; for tax filing specifics or legal obligations, say the user should confirm with KRA or their accountant.`;

exports.handler = async (event) => {
  if(event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  const admin = adminClient();

  let body;
  try{ body = JSON.parse(event.body || '{}'); }
  catch(e){ return json(400, { error: 'Invalid JSON body.' }); }

  const { branch_id: branchId, question, history } = body;
  const ctx = await requireBranchAccess(event, requireUser, admin, branchId, { write: false });
  if(ctx.error) return json(ctx.status, { error: ctx.error });

  if(!question || !question.trim()) return json(400, { error: 'question is required.' });
  if(!process.env.ANTHROPIC_API_KEY){
    return json(500, { error: 'AI assistant is not configured — ANTHROPIC_API_KEY is missing from this site\'s environment variables.' });
  }

  try{
    const summary = await buildFinancialSummary(admin, branchId);

    const trimmedHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY_TURNS) : [];
    const messages = [
      ...trimmedHistory.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'),
      { role: 'user', content: `Financial data summary (JSON):\n${JSON.stringify(summary)}\n\nQuestion: ${question}` }
    ];

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages
      })
    });

    if(!res.ok){
      const errBody = await res.text();
      console.error('Anthropic API error', res.status, errBody);
      return json(502, { error: 'The AI assistant is temporarily unavailable.' });
    }

    const data = await res.json();
    const answer = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');

    return json(200, { answer, data_as_of: summary.as_of });
  }catch(e){
    console.error('ai-assistant error', e);
    return json(500, { error: 'Unexpected error running the assistant.' });
  }
};
