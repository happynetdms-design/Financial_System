const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');
const n=v=>Number(v||0);
exports.handler=async event=>{
 const admin=adminClient(); let body={}; try{body=JSON.parse(event.body||'{}')}catch(e){}
 const q=event.queryStringParameters||{}; const branchId=body.branch_id||q.branch_id; const write=event.httpMethod!=='GET';
 const ctx=await requireBranchAccess(event,requireUser,admin,branchId,{write}); if(ctx.error)return json(ctx.status,{error:ctx.error});
 try{
  if(event.httpMethod==='GET'){
   const reconId=q.reconciliation_id; if(!reconId)return json(400,{error:'reconciliation_id required'});
   const [{data:rows,error:re},{data:matches,error:me}]=await Promise.all([
    admin.from('reconciliation_import_rows').select('*').eq('reconciliation_id',reconId).order('external_date'),
    admin.from('hfms_reconciliation_matches').select('*').eq('reconciliation_id',reconId)
   ]); if(re||me)throw(re||me); return json(200,{rows:rows||[],matches:matches||[]});
  }
  if(event.httpMethod==='POST'){
   if(body.action==='match'){
    if(!body.reconciliation_id||!body.external_row_id||!body.financial_transaction_id)return json(400,{error:'reconciliation_id, external_row_id and financial_transaction_id required'});
    const amount=n(body.matched_amount_kes); if(amount<=0)return json(400,{error:'matched_amount_kes must be positive'});
    const {data,error}=await admin.from('hfms_reconciliation_matches').upsert({reconciliation_id:body.reconciliation_id,external_row_id:body.external_row_id,financial_transaction_id:body.financial_transaction_id,match_type:body.match_type||'manual',matched_amount_kes:amount,difference_kes:n(body.difference_kes),reason:body.reason||null,matched_by:ctx.user.id},{onConflict:'external_row_id,financial_transaction_id'}).select().single(); if(error)throw error;
    await admin.from('reconciliation_import_rows').update({matched_transaction_id:body.financial_transaction_id,match_status:Math.abs(n(body.difference_kes))<0.01?'matched':'partial',match_score:body.match_score||1}).eq('id',body.external_row_id).eq('reconciliation_id',body.reconciliation_id);
    return json(201,{match:data});
  }
  if(body.action==='submit'){
    const {data,error}=await admin.from('cash_reconciliations').update({status:'submitted'}).eq('id',body.reconciliation_id).eq('branch_id',branchId).select().single(); if(error)throw error; return json(200,{reconciliation:data});
  }
  if(body.action==='approve'){
    const {data:r,error:re}=await admin.from('cash_reconciliations').select('*').eq('id',body.reconciliation_id).eq('branch_id',branchId).single(); if(re)throw re;
    const {data:unmatched,error:ue}=await admin.from('reconciliation_import_rows').select('id').eq('reconciliation_id',r.id).eq('match_status','unmatched'); if(ue)throw ue;
    if((unmatched||[]).length && !body.reason)return json(409,{error:`${unmatched.length} unmatched statement row(s). Provide a reason before approval.`});
    const {data,error}=await admin.from('cash_reconciliations').update({status:'approved',approved_by:ctx.user.id,notes:body.reason||r.notes}).eq('id',r.id).select().single(); if(error)throw error; return json(200,{reconciliation:data});
  }
  }
  return json(405,{error:'GET or POST only'});
 }catch(e){return json(500,{error:e.message});}
};
