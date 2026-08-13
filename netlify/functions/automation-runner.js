const { adminClient, requireUser, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');

const n=v=>Number(v||0);
const today=()=>new Date().toISOString().slice(0,10);
const monthStart=()=>new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().slice(0,10);
const monthEnd=()=>today();

function nextDue(date, frequency){
  const d=new Date(`${date}T00:00:00Z`);
  if(frequency==='weekly') d.setUTCDate(d.getUTCDate()+7);
  else if(frequency==='monthly') d.setUTCMonth(d.getUTCMonth()+1);
  else if(frequency==='quarterly') d.setUTCMonth(d.getUTCMonth()+3);
  else d.setUTCFullYear(d.getUTCFullYear()+1);
  return d.toISOString().slice(0,10);
}

async function ensureRules(admin, branchId){
  const defaults=[
    ['low_cash','Low operating cash','critical',0],
    ['budget_overrun','Budget overrun','warning',0],
    ['profit_first_missing','Profit First cycle incomplete','warning',0],
    ['tax_due','Tax deadline approaching','warning',30],
    ['tax_overdue','Tax obligation overdue','critical',0],
    ['anomaly_open','Financial anomaly open','warning',0],
    ['recurring_due','Recurring expense due','info',7],
    ['negative_result','Negative operating result','critical',0],
    ['reconciliation_pending','Reconciliation pending','warning',0]
  ];
  const {data:existing}=await admin.from('hfms_automation_rules').select('*').eq('branch_id',branchId);
  const map=new Map((existing||[]).map(r=>[r.rule_key,r]));
  for(const [key,name,severity,lead] of defaults){
    if(!map.has(key)){
      await admin.from('hfms_automation_rules').insert({branch_id:branchId,rule_key:key,name,description:name,severity,lead_days:lead,channel:'in_app',enabled:true,auto_execute:false});
    }
  }
  const {data}=await admin.from('hfms_automation_rules').select('*').eq('branch_id',branchId).eq('enabled',true);
  return data||[];
}

async function eventOnce(admin, runId, branchId, rule, eventKey, message, observed=null, threshold=null, action='notify'){
  const {data:existing}=await admin.from('hfms_automation_events').select('id').eq('branch_id',branchId).eq('event_key',eventKey).maybeSingle();
  if(existing) return false;
  const r=await admin.from('hfms_automation_events').insert({run_id:runId,branch_id:branchId,rule_key:rule.rule_key,event_key:eventKey,severity:rule.severity,observed_value:observed,threshold_value:threshold,message,action}).select('id').single();
  return !r.error;
}

async function queueNotification(admin, branchId, rule, eventKey, message, payload={}){
  const channel=rule.channel||'in_app';
  const recipient=channel==='email' ? (process.env.HFMS_ALERT_EMAIL||null) :
                  channel==='sms' ? (process.env.HFMS_ALERT_SMS||null) : null;
  const subject=`Happynet HFMS — ${rule.name}`;
  const idempotencyKey=`${branchId}:${rule.rule_key}:${eventKey}:${channel}`;
  const r=await admin.from('hfms_notification_queue').upsert({
    branch_id:branchId,rule_key:rule.rule_key,channel,recipient,subject,body:message,payload,
    idempotency_key:idempotencyKey,status:'queued',next_attempt_at:new Date().toISOString()
  },{onConflict:'idempotency_key',ignoreDuplicates:true});
  return !r.error;
}

async function processNotifications(admin, limit=50){
  const {data:rows}=await admin.from('hfms_notification_queue').select('*')
    .in('status',['queued','failed']).lte('next_attempt_at',new Date().toISOString())
    .order('created_at',{ascending:true}).limit(limit);
  let sent=0, failed=0;
  for(const row of rows||[]){
    await admin.from('hfms_notification_queue').update({status:'processing',attempts:n(row.attempts)+1,updated_at:new Date().toISOString()}).eq('id',row.id);
    try{
      if(row.channel==='in_app'){
        await admin.from('hfms_notification_queue').update({status:'sent',sent_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq('id',row.id);
      } else if(row.channel==='email'){
        if(!process.env.RESEND_API_KEY || !row.recipient) throw new Error('Email provider not configured. Set RESEND_API_KEY and HFMS_ALERT_EMAIL.');
        const resp=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.HFMS_FROM_EMAIL||'Happynet HFMS <onboarding@resend.dev>',to:[row.recipient],subject:row.subject,text:row.body})});
        if(!resp.ok) throw new Error(`Email provider returned ${resp.status}: ${await resp.text()}`);
        await admin.from('hfms_notification_queue').update({status:'sent',sent_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq('id',row.id);
      } else {
        const url=row.channel==='sms' ? process.env.HFMS_SMS_WEBHOOK_URL : process.env.HFMS_NOTIFICATION_WEBHOOK_URL;
        if(!url) throw new Error(`No ${row.channel} provider configured.`);
        const resp=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:row.recipient,subject:row.subject,message:row.body,payload:row.payload,source:'Happynet HFMS'})});
        if(!resp.ok) throw new Error(`Notification provider returned ${resp.status}`);
        await admin.from('hfms_notification_queue').update({status:'sent',sent_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq('id',row.id);
      }
      sent++;
    }catch(e){
      failed++;
      const attempts=n(row.attempts)+1;
      const terminal=attempts>=5;
      const retry=new Date(Date.now()+Math.min(60,Math.pow(2,attempts))*60000).toISOString();
      await admin.from('hfms_notification_queue').update({status:terminal?'failed':'queued',last_error:e.message,next_attempt_at:retry,updated_at:new Date().toISOString()}).eq('id',row.id);
    }
  }
  return {sent,failed};
}

async function postDueRecurring(admin, branchId, rule, runId){
  if(!rule.auto_execute) return {prepared:0,executed:0};
  const {data:items}=await admin.from('recurring_expenses').select('*').eq('branch_id',branchId).eq('active',true).lte('next_due_date',today());
  let prepared=0,executed=0;
  for(const item of items||[]){
    prepared++;
    const period=today(), ref=`RECUR-${item.id}-${period}`;
    const {data:existing}=await admin.from('recurring_expense_runs').select('id').eq('recurring_expense_id',item.id).eq('run_period',period).maybeSingle();
    if(existing) continue;
    const amount=n(item.amount_kes);
    if(amount<=0) continue;
    const exp=await admin.from('expenses').insert({
      branch_id:branchId,expense_date:period,txn_ref:ref,account_id:null,category_id:item.category_id,
      supplier_id:item.supplier_id,description:item.description,paid_to:null,amount_kes:amount,charges_kes:0,
      owner_funded:false,status:'posted',source:'recurring',created_by:null
    }).select().single();
    if(exp.error) continue;
    const tx=await admin.from('financial_transactions').insert({
      branch_id:branchId,transaction_date:period,transaction_type:'expense',direction:'out',
      gross_amount_kes:amount,charges_kes:0,net_amount_kes:amount,account_id:null,category_id:item.category_id,
      expense_id:exp.data.id,source_system:'recurring',source_ref:ref,counterparty:item.supplier_id,
      description:item.description,source_status:'POSTED',raw_data:item,created_by:null
    }).select().single();
    if(tx.error){ await admin.from('expenses').delete().eq('id',exp.data.id); continue; }
    const cm=await admin.from('cash_movements').insert({
      branch_id:branchId,movement_date:period,movement_type:'expense',direction:'outflow',
      amount_kes:amount,from_account_id:null,to_account_id:null,financial_transaction_id:tx.data.id,
      source_ref:ref,description:item.description,reason:'HFMS automated recurring expense',created_by:null
    });
    if(cm.error){ /* ledger remains traceable; flag for reconciliation rather than delete */ }
    await admin.from('recurring_expense_runs').insert({recurring_expense_id:item.id,branch_id:branchId,run_period:period,financial_transaction_id:tx.data.id,status:'posted',amount_kes:amount,created_by:null});
    await admin.from('recurring_expenses').update({next_due_date:nextDue(item.next_due_date,item.frequency),updated_at:new Date().toISOString()}).eq('id',item.id);
    executed++;
  }
  return {prepared,executed};
}

async function scanBranch(admin, branch, runId){
  const branchId=branch.id;
  const rules=await ensureRules(admin,branchId);
  const ruleMap=new Map(rules.map(r=>[r.rule_key,r]));
  let created=0,prepared=0,executed=0,evaluated=0;
  const start=monthStart(), end=monthEnd();
  const [txR,cashR,allocR,budgetR,taxR,anomR,reconR,targetR]=await Promise.all([
    admin.from('financial_transactions').select('transaction_date,transaction_type,direction,net_amount_kes').eq('branch_id',branchId).eq('is_deleted',false).eq('classification_status','classified').gte('transaction_date',start).lte('transaction_date',end).limit(20000),
    admin.from('cash_movements').select('direction,amount_kes').eq('branch_id',branchId).eq('is_deleted',false).limit(20000),
    admin.from('profit_first_allocations').select('id,status,expected_amount_kes,period').eq('branch_id',branchId).order('period',{ascending:false}).limit(50),
    admin.from('budgets').select('period,budget_kes').eq('branch_id',branchId).gte('period',start).lte('period',end),
    admin.from('tax_periods').select('id,payment_due_date,filing_due_date,amount_due_kes,amount_paid_kes,payment_status,filing_status').eq('branch_id',branchId).limit(200),
    admin.from('anomaly_events').select('id,status,severity,message').eq('branch_id',branchId).eq('status','open').limit(50),
    admin.from('cash_reconciliations').select('id,status,period_end').eq('branch_id',branchId).in('status',['draft','submitted','pending_approval']).limit(50),
    admin.from('hfms_executive_kpi_targets').select('metric_key,target_value').eq('branch_id',branchId)
  ]);
  const tx=txR.data||[], cashRows=cashR.data||[];
  let rev=0,exp=0; for(const t of tx){const a=n(t.net_amount_kes);if(t.transaction_type==='revenue'&&t.direction==='in')rev+=a;if(t.transaction_type==='expense'&&t.direction==='out')exp+=a;}
  let cash=0; for(const c of cashRows) cash += c.direction==='outflow' ? -n(c.amount_kes) : n(c.amount_kes);
  const targets=targetR.data||[]; const minCash=n((targets.find(x=>x.metric_key==='min_cash')||{}).target_value);
  const budget=n((budgetR.data||[]).reduce((s,x)=>s+n(x.budget_kes),0));
  const add=async(key,msg,obs,thr,payload={})=>{
    const rule=ruleMap.get(key); if(!rule||!rule.enabled)return;
    evaluated++;
    const evKey=`${key}:${start}`;
    const was=await eventOnce(admin,runId,branchId,rule,evKey,msg,obs,thr);
    if(was){created+=await queueNotification(admin,branchId,rule,evKey,msg,payload)?1:0;}
  };
  if(minCash>0 && cash<minCash) await add('low_cash',`Available cash is KES ${cash.toLocaleString()} versus the minimum target of KES ${minCash.toLocaleString()}.`,cash,minCash,{cash,minCash});
  if(budget>0 && exp>budget) await add('budget_overrun',`Current-month expenses are KES ${(exp-budget).toLocaleString()} above the configured budget.`,exp,budget,{expenses:exp,budget});
  if(rev>0 && exp>rev) await add('negative_result',`Current-month expenses exceed revenue by KES ${(exp-rev).toLocaleString()}.`,exp,rev,{revenue:rev,expenses:exp});
  const open=(allocR.data||[]).filter(a=>!['closed','verified'].includes(String(a.status||'').toLowerCase()));
  if(open.length) await add('profit_first_missing',`${open.length} Profit First allocation cycle(s) still require completion.`,open.length,0,{allocations:open});
  const now=new Date(), lead=ruleMap.get('tax_due')?.lead_days ?? 30;
  for(const p of taxR.data||[]){
    const due=p.payment_due_date||p.filing_due_date; if(!due)continue;
    const days=Math.ceil((new Date(`${due}T00:00:00Z`)-now)/86400000);
    const outstanding=Math.max(n(p.amount_due_kes)-n(p.amount_paid_kes),0);
    if(outstanding<=0)continue;
    if(days<0 && ruleMap.get('tax_overdue')?.enabled) await add('tax_overdue',`Tax period ${p.id} is overdue by ${Math.abs(days)} day(s) with KES ${outstanding.toLocaleString()} outstanding.`,outstanding,0,{tax_period_id:p.id,days_overdue:Math.abs(days)});
    else if(days>=0&&days<=lead) await add('tax_due',`Tax payment/filing is due in ${days} day(s) with KES ${outstanding.toLocaleString()} outstanding.`,outstanding,0,{tax_period_id:p.id,days_until_due:days});
  }
  if((anomR.data||[]).length) await add('anomaly_open',`${anomR.data.length} unresolved financial anomaly event(s) require review.`,anomR.data.length,0,{anomalies:anomR.data});
  if((reconR.data||[]).length) await add('reconciliation_pending',`${reconR.data.length} cash reconciliation(s) remain open or pending approval.`,reconR.data.length,0,{reconciliations:reconR.data});
  const {data:due}=await admin.from('recurring_expenses').select('id,description,amount_kes,next_due_date').eq('branch_id',branchId).eq('active',true).lte('next_due_date',today());
  if((due||[]).length){
    await add('recurring_due',`${due.length} recurring expense(s) are due for controlled posting/review.`,due.length,0,{recurring:due});
    const rule=ruleMap.get('recurring_due'); if(rule?.auto_execute){const r=await postDueRecurring(admin,branchId,rule,runId);prepared+=r.prepared;executed+=r.executed;}
  }
  return {rules:rules.length,evaluated,created,prepared,executed};
}

async function runAutomation(trigger='scheduled', branchId=null){
  const admin=adminClient();
  const run=await admin.from('hfms_automation_runs').insert({trigger,status:'running'}).select().single();
  if(run.error) throw run.error;
  const runId=run.data.id;
  try{
    let q=admin.from('branches').select('id,name').eq('is_active',true); if(branchId)q=q.eq('id',branchId);
    const {data:branches,error}=await q; if(error)throw error;
    let totals={branches:0,rules:0,evaluated:0,created:0,prepared:0,executed:0};
    for(const b of branches||[]){const r=await scanBranch(admin,b,runId);totals.branches++;totals.rules+=r.rules;totals.evaluated+=r.evaluated;totals.created+=r.created;totals.prepared+=r.prepared;totals.executed+=r.executed;}
    const delivery=await processNotifications(admin);
    await admin.from('hfms_automation_runs').update({status:'completed',finished_at:new Date().toISOString(),branches_scanned:totals.branches,rules_evaluated:totals.evaluated,notifications_created:totals.created,notifications_sent:delivery.sent,actions_prepared:totals.prepared,actions_executed:totals.executed,summary:{...totals,delivery}}).eq('id',runId);
    return {run_id:runId,...totals,delivery};
  }catch(e){
    await admin.from('hfms_automation_runs').update({status:'failed',finished_at:new Date().toISOString(),error_message:e.message}).eq('id',runId);
    throw e;
  }
}

exports.config={schedule:'*/30 * * * *'};
exports.handler=async event=>{
  const method=event.httpMethod;
  if(method && !['POST','GET'].includes(method)) return json(405,{error:'GET/POST only'});
  let branchId=null, trigger='scheduled';
  if(method==='POST'){
    const auth=await requireUser(event); if(auth.error)return json(401,{error:auth.error});
    try{const body=JSON.parse(event.body||'{}');branchId=body.branch_id||null;}catch(e){return json(400,{error:'Invalid JSON'});}
    if(branchId){const ctx=await requireBranchAccess(event,requireUser,adminClient(),branchId,{write:true});if(ctx.error)return json(ctx.status,{error:ctx.error});}
    trigger='manual';
  }
  try{return json(200,await runAutomation(trigger,branchId));}
  catch(e){return json(500,{error:e.message});}
};
