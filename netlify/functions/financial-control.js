const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');

const n = v => Number(v || 0);
const dateOr = (v, fallback) => v || fallback;
const today = () => new Date().toISOString().slice(0,10);

async function position(admin, branchId, from, to){
  let q = admin.from('financial_transactions').select('transaction_date,transaction_type,direction,net_amount_kes,category_id,account_id,counterparty,description,source_system').eq('branch_id',branchId).eq('is_deleted',false).eq('classification_status','classified');
  if(from) q=q.gte('transaction_date',from);
  if(to) q=q.lte('transaction_date',to);
  const {data,error}=await q.order('transaction_date',{ascending:true});
  if(error) throw new Error(error.message);
  const rows=data||[];
  const out={revenue:0,expenses:0,ownerLoanFunding:0,ownerLoanRepayment:0,inflows:0,outflows:0,net:0};
  for(const r of rows){ const a=n(r.net_amount_kes); if(r.direction==='inflow') out.inflows+=a; else out.outflows+=a; out.net += r.direction==='inflow'?a:-a; if(r.transaction_type==='revenue') out.revenue+=a; if(r.transaction_type==='expense') out.expenses+=a; if(r.transaction_type==='owner_loan_funding') out.ownerLoanFunding+=a; if(r.transaction_type==='owner_loan_repayment') out.ownerLoanRepayment+=a; }
  return { ...out, rows };
}

async function generateAlerts(admin, branchId, period){
  const p=await position(admin,branchId,`${period}-01`,`${period}-31`);
  const alerts=[];
  if(p.expenses>p.revenue && p.revenue>0) alerts.push({alert_type:'negative_operating_result',severity:'critical',title:'Expenses exceed revenue',message:`Expenses of KES ${p.expenses.toLocaleString()} exceed revenue of KES ${p.revenue.toLocaleString()} for ${period}.`,metric_value:p.expenses,threshold_value:p.revenue});
  const {data:settings}=await admin.from('profit_first_settings').select('*').eq('branch_id',branchId).maybeSingle();
  if(settings && p.revenue>0){ const expectedOpex=p.revenue*n(settings.pct_opex)/100; if(p.expenses>expectedOpex) alerts.push({alert_type:'budget_overrun',severity:'warning',title:'Operating expense allocation exceeded',message:`Expenses are KES ${(p.expenses-expectedOpex).toLocaleString()} above the Profit First OpEx allocation.`,metric_value:p.expenses,threshold_value:expectedOpex}); }
  const {data:open}=await admin.from('financial_transactions').select('id').eq('branch_id',branchId).eq('classification_status','review').eq('is_deleted',false);
  if((open||[]).length) alerts.push({alert_type:'review_queue',severity:'warning',title:'Financial transactions need review',message:`${open.length} imported transaction(s) are awaiting classification.`,metric_value:open.length,threshold_value:0});
  for(const a of alerts){
    const exists=await admin.from('financial_alerts').select('id').eq('branch_id',branchId).eq('alert_type',a.alert_type).eq('status','open').maybeSingle();
    if(!exists.data) await admin.from('financial_alerts').insert({branch_id:branchId,...a});
  }
  return alerts;
}

exports.handler=async event=>{
  const admin=adminClient(); const method=event.httpMethod;
  let body={}; if(method!=='GET'){try{body=JSON.parse(event.body||'{}')}catch{return json(400,{error:'Invalid JSON'})}}
  const qs=event.queryStringParameters||{}; const branchId=method==='GET'?qs.branch_id:body.branch_id;
  const ctx=await requireBranchAccess(event,requireUser,admin,branchId,{write:method!=='GET'}); if(ctx.error)return json(ctx.status,{error:ctx.error});
  try{
    if(method==='GET'){
      const action=qs.action||'summary';
      if(action==='summary'){
        const p=await position(admin,branchId,qs.from,qs.to);
        const {data:loans}=await admin.from('loans').select('debt_name,lender,current_balance_kes,original_principal_kes,status').eq('branch_id',branchId).eq('is_deleted',false);
        const {data:alerts}=await admin.from('financial_alerts').select('*').eq('branch_id',branchId).eq('status','open').order('created_at',{ascending:false});
        return json(200,{position:p,loans:loans||[],alerts:alerts||[]});
      }
      if(action==='cash'){
        const {data:accounts,error}=await admin.from('financial_accounts').select('id,name,kind,is_active').eq('branch_id',branchId).eq('is_active',true).order('name'); if(error)throw new Error(error.message);
        const results=[]; for(const a of accounts){ let q=admin.from('cash_movements').select('direction,amount_kes,from_account_id,to_account_id,movement_type').eq('branch_id',branchId).eq('is_deleted',false).or(`from_account_id.eq.${a.id},to_account_id.eq.${a.id}`); const {data,error:e}=await q; if(e)throw new Error(e.message); let bal=0; for(const m of data||[]){const amount=n(m.amount_kes); if(m.movement_type==='transfer'){if(m.from_account_id===a.id)bal-=amount;if(m.to_account_id===a.id)bal+=amount;}else if(m.to_account_id===a.id && m.direction==='inflow')bal+=amount; else if(m.from_account_id===a.id && m.direction==='outflow')bal-=amount;} results.push({...a,system_balance_kes:bal}); }
        return json(200,{accounts:results});
      }
      if(action==='alerts') return json(200,{alerts:(await admin.from('financial_alerts').select('*').eq('branch_id',branchId).order('created_at',{ascending:false}).limit(100)).data||[]});
      if(action==='report'){
        const from=qs.from, to=qs.to; const p=await position(admin,branchId,from,to);
        const {data:rows}=await admin.from('financial_transactions').select('transaction_date,transaction_type,direction,net_amount_kes,description,counterparty,source_system').eq('branch_id',branchId).eq('is_deleted',false).eq('classification_status','classified').gte('transaction_date',from).lte('transaction_date',to).order('transaction_date');
        return json(200,{from,to,summary:{revenue:p.revenue,expenses:p.expenses,netOperating:p.revenue-p.expenses,ownerLoanFunding:p.ownerLoanFunding,ownerLoanRepayment:p.ownerLoanRepayment},transactions:rows||[]});
      }
      return json(400,{error:'Unknown action'});
    }
    if(method==='POST'){
      const action=body.action;
      if(action==='cash_movement'){
        if(!body.movement_date||!body.amount_kes||!body.movement_type||!body.direction)return json(400,{error:'movement_date, amount_kes, movement_type and direction are required'});
        const {data,error}=await admin.from('cash_movements').insert({branch_id:branchId,movement_date:body.movement_date,movement_type:body.movement_type,direction:body.direction,amount_kes:body.amount_kes,from_account_id:body.from_account_id||null,to_account_id:body.to_account_id||null,financial_transaction_id:body.financial_transaction_id||null,source_ref:body.source_ref||null,description:body.description||null,reason:body.reason||null,created_by:ctx.user.id}).select().maybeSingle(); if(error)throw new Error(error.message); return json(201,{movement:data});
      }
      if(action==='transfer'){
        if(!body.movement_date||!body.amount_kes||!body.from_account_id||!body.to_account_id)return json(400,{error:'movement_date, amount_kes, from_account_id and to_account_id are required'});
        const {data:movement,error}=await admin.from('cash_movements').insert({branch_id:branchId,movement_date:body.movement_date,movement_type:'transfer',direction:'outflow',amount_kes:body.amount_kes,from_account_id:body.from_account_id,to_account_id:body.to_account_id,source_ref:body.source_ref||null,description:body.description||'Internal account transfer',reason:body.reason||'Cash transfer',created_by:ctx.user.id}).select().maybeSingle(); if(error)throw new Error(error.message); return json(201,{movement});
      }
      if(action==='reconcile'){
        const payload={branch_id:branchId,account_id:body.account_id,reconciliation_date:body.reconciliation_date||today(),system_balance_kes:body.system_balance_kes||0,actual_balance_kes:body.actual_balance_kes||0,status:'submitted',explanation:body.explanation||null,created_by:ctx.user.id};
        const {data,error}=await admin.from('cash_reconciliations').upsert(payload,{onConflict:'branch_id,account_id,reconciliation_date'}).select().maybeSingle(); if(error)throw new Error(error.message); return json(201,{reconciliation:data});
      }
      if(action==='generate_alerts'){const period=body.period||today().slice(0,7); return json(200,{alerts:await generateAlerts(admin,branchId,period)});}
      return json(400,{error:'Unknown action'});
    }
    if(method==='PATCH'){
      if(body.action==='alert_status'){const patch={status:body.status}; if(body.status==='acknowledged'){patch.acknowledged_by=ctx.user.id;patch.acknowledged_at=new Date().toISOString();} const {data,error}=await admin.from('financial_alerts').update(patch).eq('id',body.id).eq('branch_id',branchId).select().maybeSingle();if(error)throw new Error(error.message);return json(200,{alert:data});}
      if(body.action==='approve_reconciliation'){const {data,error}=await admin.from('cash_reconciliations').update({status:'approved',approved_by:ctx.user.id,approved_at:new Date().toISOString()}).eq('id',body.id).eq('branch_id',branchId).select().maybeSingle();if(error)throw new Error(error.message);return json(200,{reconciliation:data});}
      return json(400,{error:'Unknown action'});
    }
    return json(405,{error:'Method not allowed'});
  }catch(e){console.error(e);return json(500,{error:e.message||'Financial control error'});}
};
