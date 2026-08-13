const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');
const n=v=>Number(v||0);
exports.handler=async event=>{
 if(event.httpMethod!=='GET')return json(405,{error:'GET only'});
 const q=event.queryStringParameters||{}; const branchId=q.branch_id; const from=q.from||`${new Date().getUTCFullYear()}-01-01`; const to=q.to||new Date().toISOString().slice(0,10);
 const ctx=await requireBranchAccess(event,requireUser,adminClient(),branchId,{write:false});if(ctx.error)return json(ctx.status,{error:ctx.error});
 const db=adminClient();
 try{
  const {data,error}=await db.from('financial_transactions').select('transaction_date,transaction_type,direction,net_amount_kes,description,counterparty,source_system').eq('branch_id',branchId).eq('is_deleted',false).eq('classification_status','classified').gte('transaction_date',from).lte('transaction_date',to).order('transaction_date');if(error)throw error;
  const rows=data||[]; const revenue=rows.filter(r=>r.transaction_type==='revenue'&&r.direction==='in').reduce((s,r)=>s+n(r.net_amount_kes),0); const expenses=rows.filter(r=>r.transaction_type==='expense'&&r.direction==='out').reduce((s,r)=>s+n(r.net_amount_kes),0); const funding=rows.filter(r=>r.transaction_type==='owner_loan_funding'&&r.direction==='in').reduce((s,r)=>s+n(r.net_amount_kes),0); const repayments=rows.filter(r=>r.transaction_type==='owner_loan_repayment'&&r.direction==='out').reduce((s,r)=>s+n(r.net_amount_kes),0); const cashIn=rows.filter(r=>r.direction==='in').reduce((s,r)=>s+n(r.net_amount_kes),0); const cashOut=rows.filter(r=>r.direction==='out').reduce((s,r)=>s+n(r.net_amount_kes),0);
  const byMonth={}; for(const r of rows){const m=String(r.transaction_date).slice(0,7);byMonth[m]??={revenue:0,expenses:0,cash_in:0,cash_out:0}; if(r.transaction_type==='revenue'&&r.direction==='in')byMonth[m].revenue+=n(r.net_amount_kes);if(r.transaction_type==='expense'&&r.direction==='out')byMonth[m].expenses+=n(r.net_amount_kes);if(r.direction==='in')byMonth[m].cash_in+=n(r.net_amount_kes);else byMonth[m].cash_out+=n(r.net_amount_kes);}
  return json(200,{period:{from,to},executive:{revenue,expenses,operating_result:revenue-expenses,cash_in:cashIn,cash_out:cashOut,net_cash_movement:cashIn-cashOut,owner_loan_funding:funding,owner_loan_repayments:repayments,owner_loan_balance:funding-repayments,transaction_count:rows.length},monthly:Object.entries(byMonth).sort((a,b)=>a[0].localeCompare(b[0])).map(([month,v])=>({month,...v,operating_result:v.revenue-v.expenses})),source_mix:rows.reduce((a,r)=>(a[r.source_system]=(a[r.source_system]||0)+1,a),{})});
 }catch(e){return json(500,{error:e.message});}
};
