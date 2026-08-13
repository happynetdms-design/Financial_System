const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');
const n=v=>Number(v||0);
exports.handler=async event=>{
  if(event.httpMethod!=='GET') return json(405,{error:'GET only'});
  const q=event.queryStringParameters||{};
  const branchId=q.branch_id;
  const from=q.from||`${new Date().getUTCFullYear()}-01-01`;
  const to=q.to||new Date().toISOString().slice(0,10);
  const ctx=await requireBranchAccess(event,requireUser,adminClient(),branchId,{write:false});
  if(ctx.error) return json(ctx.status,{error:ctx.error});
  const admin=adminClient();
  try{
    const {data,error}=await admin.from('financial_transactions')
      .select('transaction_date,transaction_type,direction,net_amount_kes,description,counterparty')
      .eq('branch_id',branchId).eq('is_deleted',false).eq('classification_status','classified')
      .gte('transaction_date',from).lte('transaction_date',to);
    if(error) throw error;
    const rows=data||[];
    const revenue=rows.filter(r=>r.transaction_type==='revenue'&&r.direction==='in').reduce((a,r)=>a+n(r.net_amount_kes),0);
    const expenses=rows.filter(r=>r.transaction_type==='expense'&&r.direction==='out').reduce((a,r)=>a+n(r.net_amount_kes),0);
    const funding=rows.filter(r=>r.transaction_type==='owner_loan_funding'&&r.direction==='in').reduce((a,r)=>a+n(r.net_amount_kes),0);
    const repayments=rows.filter(r=>r.transaction_type==='owner_loan_repayment'&&r.direction==='out').reduce((a,r)=>a+n(r.net_amount_kes),0);
    const cashIn=rows.filter(r=>r.direction==='in').reduce((a,r)=>a+n(r.net_amount_kes),0);
    const cashOut=rows.filter(r=>r.direction==='out').reduce((a,r)=>a+n(r.net_amount_kes),0);
    const expenseByType={}; rows.filter(r=>r.transaction_type==='expense').forEach(r=>{const k=r.description||'Unclassified';expenseByType[k]=(expenseByType[k]||0)+n(r.net_amount_kes);});
    return json(200,{period:{from,to},pnl:{revenue,expenses,operating_result:revenue-expenses},cash_flow:{cash_in:cashIn,cash_out:cashOut,net_cash_movement:cashIn-cashOut},owner_loan:{funding,repayments,balance:funding-repayments},expense_breakdown:Object.entries(expenseByType).sort((a,b)=>b[1]-a[1]).slice(0,20),transaction_count:rows.length});
  }catch(e){return json(500,{error:e.message});}
};
