const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');
const n=v=>Number(v||0);
exports.handler=async event=>{
 if(event.httpMethod!=='POST') return json(405,{error:'POST only'});
 const admin=adminClient(); let body={}; try{body=JSON.parse(event.body||'{}')}catch(e){return json(400,{error:'Invalid JSON'});}
 const branchId=body.branch_id; const period=String(body.run_period||new Date().toISOString().slice(0,10)).slice(0,10);
 const ctx=await requireBranchAccess(event,requireUser,admin,branchId,{write:true}); if(ctx.error)return json(ctx.status,{error:ctx.error});
 try{
  const {data:items,error}=await admin.from('recurring_expenses').select('*').eq('branch_id',branchId).eq('is_deleted',false);
  if(error)throw error;
  const results=[];
  for(const item of items||[]){
   if(item.next_due_date && String(item.next_due_date).slice(0,10)>period) continue;
   const {data:existing}=await admin.from('recurring_expense_runs').select('id').eq('recurring_expense_id',item.id).eq('run_period',period).maybeSingle();
   if(existing){results.push({id:item.id,status:'skipped',reason:'already processed'});continue;}
   const amount=n(item.amount_kes); if(amount<=0){results.push({id:item.id,status:'failed',reason:'amount is zero'});continue;}
   const accountId=null;
   const categoryId=item.category_id||null;
   const exp=await admin.from('expenses').insert({branch_id:branchId,expense_date:period,txn_ref:`RECUR-${item.id}-${period}`,account_id:accountId,category_id:categoryId,description:item.description||'Recurring expense',paid_to:item.supplier_id||null,amount_kes:amount,charges_kes:n(item.charges_kes),owner_funded:false,status:'posted',source:'recurring',created_by:ctx.user.id}).select().single();
   if(exp.error){await admin.from('recurring_expense_runs').insert({recurring_expense_id:item.id,branch_id:branchId,run_period:period,status:'failed',amount_kes:amount,error_message:exp.error.message,created_by:ctx.user.id});results.push({id:item.id,status:'failed',reason:exp.error.message});continue;}
   const tx=await admin.from('financial_transactions').insert({branch_id:branchId,transaction_date:period,transaction_type:'expense',direction:'out',gross_amount_kes:amount,charges_kes:n(item.charges_kes),net_amount_kes:amount+n(item.charges_kes),account_id:accountId,category_id:categoryId,expense_id:exp.data.id,source_system:'recurring',source_ref:`RECUR-${item.id}-${period}`,counterparty:item.supplier_id||null,description:item.description||'Recurring expense',source_status:'POSTED',raw_data:item,created_by:ctx.user.id}).select().single();
   if(tx.error){await admin.from('expenses').delete().eq('id',exp.data.id);results.push({id:item.id,status:'failed',reason:tx.error.message});continue;}
   await admin.from('cash_movements').insert({branch_id:branchId,movement_date:period,movement_type:'expense',direction:'out',amount_kes:amount+n(item.charges_kes),from_account_id:accountId,to_account_id:null,financial_transaction_id:tx.data.id,source_ref:`RECUR-${item.id}-${period}`,description:item.description||'Recurring expense',reason:'Automated recurring expense posting',created_by:ctx.user.id});
   await admin.from('recurring_expense_runs').insert({recurring_expense_id:item.id,branch_id:branchId,run_period:period,financial_transaction_id:tx.data.id,status:'posted',amount_kes:amount+n(item.charges_kes),created_by:ctx.user.id});
   results.push({id:item.id,status:'posted',amount_kes:amount+n(item.charges_kes)});
  }
  return json(200,{period,results});
 }catch(e){return json(500,{error:e.message});}
};
