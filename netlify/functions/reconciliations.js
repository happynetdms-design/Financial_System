const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');
exports.handler=async event=>{
 const method=event.httpMethod, q=event.queryStringParameters||{};
 const branchId=q.branch_id || (event.body&&JSON.parse(event.body||'{}').branch_id);
 const ctx=await requireBranchAccess(event,requireUser,adminClient(),branchId,{write:method!=='GET'});
 if(ctx.error)return json(ctx.status,{error:ctx.error});
 const admin=adminClient();
 try{
  if(method==='GET'){
   const {data,error}=await admin.from('cash_reconciliations').select('*').eq('branch_id',branchId).order('period_end',{ascending:false}).limit(50);
   if(error)throw error; return json(200,{reconciliations:data||[]});
  }
  const body=JSON.parse(event.body||'{}');
  if(method==='POST'){
   const {data,error}=await admin.from('cash_reconciliations').insert({branch_id:branchId,account_id:body.account_id||null,period_start:body.period_start,period_end:body.period_end,statement_balance:Number(body.statement_balance||0),ledger_balance:Number(body.ledger_balance||0),notes:body.notes||null,prepared_by:ctx.user.id}).select().single();
   if(error)throw error; return json(201,{reconciliation:data});
  }
  if(method==='PATCH'){
   if(!body.id)return json(400,{error:'id required'});
   const patch={status:body.status,notes:body.notes}; if(body.status==='approved')patch.approved_by=ctx.user.id;
   const {data,error}=await admin.from('cash_reconciliations').update(patch).eq('id',body.id).eq('branch_id',branchId).select().single();
   if(error)throw error; return json(200,{reconciliation:data});
  }
  return json(405,{error:'GET, POST or PATCH only'});
 }catch(e){return json(500,{error:e.message});}
};
