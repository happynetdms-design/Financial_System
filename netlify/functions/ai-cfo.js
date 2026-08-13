const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');

const MODEL = process.env.HFMS_AI_MODEL || 'claude-sonnet-5';
const MAX_TX = 5000;
const n = v => Number(v || 0);
const money = v => Math.round(n(v) * 100) / 100;

function monthKey(d){ return String(d || '').slice(0,7); }
function iso(d){ return d ? new Date(d).toISOString().slice(0,10) : null; }
function cleanHistory(history){
  return (Array.isArray(history) ? history : []).filter(x => x && (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string').slice(-12);
}
function extractText(data){ return (data.content || []).filter(x => x.type === 'text').map(x => x.text).join('\n').trim(); }
function stripJsonFence(s){ return String(s||'').replace(/^```json\s*/i,'').replace(/```$/,'').trim(); }
function safeJson(s){ try { return JSON.parse(stripJsonFence(s)); } catch { return null; } }
function fmt(v){ return `KES ${n(v).toLocaleString('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2})}`; }

async function buildContext(db, branchId, userId){
  const [txR, allocR, alertR, budgetR, loanR, acctR, recR, supplierR, insightR, memoryR, cashR] = await Promise.all([
    db.from('financial_transactions').select('id,transaction_date,transaction_type,direction,net_amount_kes,gross_amount_kes,charges_kes,category_id,counterparty,description,source_system,source_ref,classification_status').eq('branch_id',branchId).eq('is_deleted',false).eq('classification_status','classified').order('transaction_date',{ascending:false}).limit(MAX_TX),
    db.from('profit_first_allocations').select('*').eq('branch_id',branchId).order('created_at',{ascending:false}).limit(120),
    db.from('financial_alerts').select('alert_type,severity,title,message,status,created_at').eq('branch_id',branchId).in('status',['open','acknowledged']).order('created_at',{ascending:false}).limit(80),
    db.from('budgets').select('*').eq('branch_id',branchId).order('period_start',{ascending:false}).limit(120),
    db.from('loans').select('id,debt_name,lender,current_balance_kes,min_monthly_payment_kes,status').eq('branch_id',branchId).eq('is_deleted',false),
    db.from('chart_of_accounts').select('id,code,name,account_type,is_active').eq('branch_id',branchId).eq('is_active',true).order('code'),
    db.from('recurring_expenses').select('id,description,amount_kes,frequency,next_due_date,active').eq('branch_id',branchId).order('next_due_date').limit(100),
    db.from('suppliers').select('id,canonical_name,status').eq('branch_id',branchId).order('canonical_name').limit(300),
    db.from('ai_financial_insights').select('classification,title,message,evidence,created_at').eq('branch_id',branchId).order('created_at',{ascending:false}).limit(60),
    db.from('ai_cfo_memory').select('memory_type,content,source,updated_at').eq('branch_id',branchId).eq('user_id',userId).eq('active',true).order('updated_at',{ascending:false}).limit(40),
    db.from('cash_movements').select('account_id,direction,amount_kes').eq('branch_id',branchId).eq('is_deleted',false).limit(5000)
  ]);
  const tx = txR.data || [];
  const months = {};
  const categories = {};
  let revenue=0, expenses=0, funding=0, repayments=0, cashIn=0, cashOut=0;
  for(const r of tx){
    const a=n(r.net_amount_kes), m=monthKey(r.transaction_date);
    if(!months[m]) months[m]={revenue:0,expenses:0,funding:0,repayments:0,cash_in:0,cash_out:0};
    if(r.direction==='in') cashIn+=a;
    if(r.direction==='out') cashOut+=a;
    if(r.transaction_type==='revenue' && r.direction==='in'){ revenue+=a; months[m].revenue+=a; months[m].cash_in+=a; }
    if(r.transaction_type==='expense' && r.direction==='out'){ expenses+=a; months[m].expenses+=a; months[m].cash_out+=a; const c=r.category_id||'uncategorized'; categories[c]=(categories[c]||0)+a; }
    if(r.transaction_type==='owner_loan_funding' && r.direction==='in'){ funding+=a; months[m].funding+=a; months[m].cash_in+=a; }
    if(r.transaction_type==='owner_loan_repayment' && r.direction==='out'){ repayments+=a; months[m].repayments+=a; months[m].cash_out+=a; }
  }
  const keys=Object.keys(months).sort();
  const recent=keys.slice(-3), prior=keys.slice(-3,-6);
  const avg=(arr,k)=>arr.length?arr.reduce((s,m)=>s+n(months[m]?.[k]),0)/arr.length:0;
  const avgRev=avg(recent,'revenue'), avgExp=avg(recent,'expenses');
  const priorRev=avg(prior,'revenue');
  const growth=priorRev?((avgRev-priorRev)/priorRev)*100:null;
  const loanBalance=(loanR.data||[]).reduce((s,x)=>s+n(x.current_balance_kes),0);
  const burn=Math.max(avgExp-avgRev,0);
  const cashNet=cashIn-cashOut;
  const cashBalance=(cashR.data||[]).reduce((s,r)=>s+n(r.amount_kes)*(r.direction==='outflow' || r.direction==='out' ? -1 : 1),0);
  const runway=burn>0?cashBalance/burn:null;
  return {
    generated_at:new Date().toISOString(), branch_id:branchId,
    source_of_truth:'classified financial_transactions and posted accounting records',
    ledger:{revenue,expenses,operating_result:revenue-expenses,owner_loan_funding:funding,owner_loan_repayment:repayments,net_cash_movement:cashNet,transaction_count:tx.length},
    trends:{months:keys.slice(-12).map(k=>({month:k,...months[k]})),recent_avg_revenue:avgRev,recent_avg_expenses:avgExp,recent_revenue_growth_pct:growth,cash_burn_after_revenue:burn},
    profit_first:{allocations:allocR.data||[]},
    cash:{inflows:cashIn,outflows:cashOut,net_movement:cashNet,balance:cashBalance,runway_months:runway},
    loans:{items:loanR.data||[],total_balance:loanBalance},
    budgets:budgetR.data||[],
    alerts:alertR.data||[],
    accounts:acctR.data||[],
    recurring_expenses:recR.data||[],
    suppliers:supplierR.data||[],
    prior_ai_insights:insightR.data||[],
    user_memory:memoryR.data||[],
    recent_transactions:tx.slice(0,150),
    expense_categories:categories
  };
}

const SYSTEM = `You are HFMS CFO, the embedded senior finance manager, controller, Profit First coach and management analyst for Happynet Internet Services.

You are part of a real financial application. The database ledger is the source of truth. You must never invent financial data, balances, transactions, dates, percentages or account names. If a value is not present in the supplied context, say it is unavailable.

ACCOUNTING RULES:
1. Organization Utility completed settlements are revenue.
2. Tende outgoing transactions are operating expenses, including applicable Tende charges.
3. Tende incoming funds identified as John/owner funding are owner/director loans, NEVER revenue.
4. John/owner loan repayments reduce the liability and are NOT operating expenses.
5. Profit First is the governing cash-management philosophy. Allocated money is not ordinary spendable operating cash.
6. Distinguish actual accounting results from forecasts and scenarios.
7. Tax/legal conclusions require professional confirmation.

RESPONSE CLASSES:
- FACT: directly observed from ledger/context.
- CALCULATION: arithmetic derived from supplied facts.
- FORECAST: forward-looking and must include assumptions.
- RECOMMENDATION: an action management may consider.
- RISK: a financial/control concern.

AI CAPABILITIES:
You can explain, compare, summarize, forecast, create management reports, prepare draft actions, identify risks, recommend cost controls, review Profit First discipline, analyze loans, budgets and cash, and guide users through HFMS workflows.

CONTROLLED ACTIONS:
Never claim to have posted, transferred, closed, deleted, reconciled or otherwise mutated financial records unless a dedicated backend action confirms execution. For mutations, return a proposed action that requires explicit confirmation and RBAC. Read-only reports can be generated immediately.

When asked to create a report, produce a management-ready report with: title, period, executive summary, KPIs, findings, risks, recommendations, data notes.
When asked for advice, give a prioritized answer and cite the underlying figures from context.
When asked for a scenario, label it FORECAST and state assumptions.
When asked about Profit First, focus on cash discipline, allocation targets, allocation completion, proof/variance and the separation between allocated cash and operating cash.

OUTPUT: Return valid JSON only with this shape:
{"answer":"human-readable response","classification":"FACT|CALCULATION|FORECAST|RECOMMENDATION|RISK","citations":[{"source":"...","detail":"..."}],"action":null|{"action_type":"create_financial_recommendation|create_report|create_draft_journal|prepare_allocation|prepare_reconciliation","risk_level":"low|medium|high|critical","payload":{},"confirmation_text":"..."}}
Do not include markdown fences around the JSON.`;

function fallbackAnswer(context, question){
  const q=question.toLowerCase();
  const l=context.ledger;
  if(q.includes('revenue')) return {answer:`FACT — Classified revenue in the supplied ledger is ${fmt(l.revenue)}. Expenses are ${fmt(l.expenses)}, giving an operating result of ${fmt(l.operating_result)}.`,classification:'FACT',citations:[{source:'financial_transactions',detail:'Classified revenue and expense transactions for the selected branch.'}],action:null};
  if(q.includes('john') || q.includes('loan')) return {answer:`FACT — The current recorded owner-loan balance is ${fmt(context.loans.total_balance)}. Owner funding recorded is ${fmt(l.owner_loan_funding)} and owner repayments are ${fmt(l.owner_loan_repayment)} in the supplied classified ledger context.`,classification:'FACT',citations:[{source:'loans',detail:'Current owner/loan balances.'},{source:'financial_transactions',detail:'Owner funding and repayment transactions.'}],action:null};
  if(q.includes('profit first')) return {answer:`FACT — HFMS has ${context.profit_first.allocations.length} Profit First allocation records in the supplied context. The system treats allocated cash as reserved rather than ordinary operating cash. Review allocation status and proof/variance before treating an allocation as completed.`,classification:'FACT',citations:[{source:'profit_first_allocations',detail:'Allocation records for the selected branch.'}],action:null};
  return {answer:`I can analyze the selected branch's classified ledger, Profit First allocations, budgets, alerts, loans, suppliers and accounting context. I could not safely infer a more specific answer from the supplied data.`,classification:'FACT',citations:[{source:'HFMS',detail:'Live branch financial context supplied to the CFO.'}],action:null};
}

exports.handler = async event => {
  if(event.httpMethod!=='POST') return json(405,{error:'POST only'});
  const auth=await requireUser(event); if(auth.error)return json(401,{error:auth.error});
  const db=adminClient(); let body; try{body=JSON.parse(event.body||'{}')}catch{return json(400,{error:'Invalid JSON.'});}
  const branchId=body.branch_id, question=String(body.question||'').trim();
  if(!branchId||!question)return json(400,{error:'branch_id and question are required.'});
  const access=await requireBranchAccess(event,requireUser,db,branchId,{write:false}); if(access.error)return json(access.status,{error:access.error});
  try{
    const context=await buildContext(db,branchId,access.user.id);
    let conversationId=body.conversation_id||null;
    if(!conversationId){
      const {data:c,error:e}=await db.from('ai_conversations').insert({branch_id:branchId,user_id:access.user.id,title:question.slice(0,100)}).select().single();
      if(e) throw e; conversationId=c.id;
    } else {
      const {data:c,error:e}=await db.from('ai_conversations').select('id').eq('id',conversationId).eq('branch_id',branchId).eq('user_id',access.user.id).maybeSingle();
      if(e||!c)return json(404,{error:'Conversation not found.'});
    }
    await db.from('ai_messages').insert({conversation_id:conversationId,role:'user',content:question,message_type:'chat'});
    let result;
    if(!process.env.ANTHROPIC_API_KEY){ result=fallbackAnswer(context,question); }
    else {
      const history=body.history?.length?cleanHistory(body.history):(await db.from('ai_messages').select('role,content').eq('conversation_id',conversationId).order('created_at',{ascending:false}).limit(12)).data?.reverse()||[];
      const prompt=`LIVE HFMS CONTEXT:\n${JSON.stringify(context)}\n\nUSER REQUEST:\n${question}\n\nRemember: use only the supplied context for financial facts.`;
      const response=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:MODEL,max_tokens:2600,temperature:0.1,system:SYSTEM,messages:[...history,{role:'user',content:prompt}]})});
      if(!response.ok){ console.error(await response.text()); result=fallbackAnswer(context,question); result.answer='AI provider was unavailable, so HFMS returned a ledger-grounded deterministic answer.\n\n'+result.answer; }
      else { const data=await response.json(); const text=extractText(data); result=safeJson(text)||fallbackAnswer(context,question); }
    }
    if(!result || typeof result!=='object') result=fallbackAnswer(context,question);
    const answer=String(result.answer||'');
    await db.from('ai_messages').insert({conversation_id:conversationId,role:'assistant',content:answer,message_type:result.classification||'chat',citations:result.citations||[]});
    let action=null;
    if(result.action){
      const a=result.action;
      const {data:ar,error:e}=await db.from('ai_action_requests').insert({branch_id:branchId,user_id:access.user.id,conversation_id:conversationId,action_type:a.action_type,action_payload:a.payload||{},risk_level:a.risk_level||'medium',status:'awaiting_confirmation',confirmation_text:a.confirmation_text||'Confirm this proposed action.'}).select().single();
      if(!e) action={...a,id:ar.id,status:'awaiting_confirmation'};
    }
    if(result.classification && ['FACT','CALCULATION','FORECAST','RECOMMENDATION','RISK'].includes(result.classification)){
      await db.from('ai_financial_insights').insert({branch_id:branchId,insight_type:'cfo_conversation',classification:result.classification,title:'HFMS CFO analysis',message:answer,evidence:{citations:result.citations||[],conversation_id:conversationId}});
    }
    await db.from('ai_conversations').update({updated_at:new Date().toISOString()}).eq('id',conversationId);
    return json(200,{conversation_id:conversationId,answer,classification:result.classification||'FACT',citations:result.citations||[],proposed_action:action,as_of:context.generated_at});
  }catch(e){ console.error('ai-cfo',e); return json(500,{error:e.message||'HFMS CFO failed.'}); }
};
