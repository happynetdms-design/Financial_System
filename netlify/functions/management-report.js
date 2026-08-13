const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');
const money=v=>Number(v||0);
exports.handler=async event=>{
 if(event.httpMethod!=='GET')return json(405,{error:'GET only'});
 const q=event.queryStringParameters||{}; const branchId=q.branch_id; const ctx=await requireBranchAccess(event,requireUser,adminClient(),branchId,{write:false}); if(ctx.error)return json(ctx.status,{error:ctx.error}); const admin=adminClient();
 const from=q.from||`${new Date().getUTCFullYear()}-01-01`; const to=q.to||new Date().toISOString().slice(0,10);
 try{
  const {data:tx,error}=await admin.from('financial_transactions').select('transaction_date,transaction_type,direction,net_amount_kes,description,counterparty,source_system,category_id').eq('branch_id',branchId).eq('is_deleted',false).eq('classification_status','classified').gte('transaction_date',from).lte('transaction_date',to).order('transaction_date'); if(error)throw new Error(error.message);
  const s={revenue:0,expenses:0,ownerLoanFunding:0,ownerLoanRepayment:0}; const monthly={};
  for(const r of tx||[]){const a=money(r.net_amount_kes);if(r.transaction_type==='revenue')s.revenue+=a;if(r.transaction_type==='expense')s.expenses+=a;if(r.transaction_type==='owner_loan_funding')s.ownerLoanFunding+=a;if(r.transaction_type==='owner_loan_repayment')s.ownerLoanRepayment+=a;const m=r.transaction_date.slice(0,7);monthly[m]??={revenue:0,expenses:0};if(r.transaction_type==='revenue')monthly[m].revenue+=a;if(r.transaction_type==='expense')monthly[m].expenses+=a;}
  const {data:loans}=await admin.from('loans').select('debt_name,lender,current_balance_kes,original_principal_kes,status').eq('branch_id',branchId).eq('is_deleted',false);
  const {data:settings}=await admin.from('profit_first_settings').select('*').eq('branch_id',branchId).maybeSingle();
  return json(200,{period:{from,to},summary:{...s,netProfit:s.revenue-s.expenses,netCashMovement:s.revenue+s.ownerLoanFunding-s.expenses-s.ownerLoanRepayment},monthly,loans:loans||[],profitFirst:settings||null,transactionCount:(tx||[]).length});
 }catch(e){return json(500,{error:e.message});}
};
