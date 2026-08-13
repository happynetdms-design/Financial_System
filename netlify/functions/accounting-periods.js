const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');
exports.handler=async event=>{
  const method=event.httpMethod; const body=method==='GET'?{}:JSON.parse(event.body||'{}');
  const q=event.queryStringParameters||{}; const branchId=q.branch_id||body.branch_id;
  const ctx=await requireBranchAccess(event,requireUser,adminClient(),branchId,{write:method!=='GET'});
  if(ctx.error)return json(ctx.status,{error:ctx.error});
  const db=adminClient();
  try{
    if(method==='GET'){const {data,error}=await db.from('accounting_periods').select('*').eq('branch_id',branchId).order('period_start',{ascending:false}).limit(36);if(error)throw error;return json(200,{periods:data||[]});}
    if(!['owner','finance_manager','accountant'].includes(ctx.role))return json(403,{error:'Only finance control roles may close or reopen periods.'});
    if(method==='POST'){
      if(!body.period_start||!body.period_end)return json(400,{error:'period_start and period_end are required'});
      const {data,error}=await db.from('accounting_periods').insert({branch_id:branchId,period_start:body.period_start,period_end:body.period_end,status:'closed',closed_by:ctx.user.id,closed_at:new Date().toISOString(),reason:body.reason||'Period closed through HFMS'}).select().single();
      if(error)throw error; return json(201,{period:data});
    }
    if(method==='PATCH'){
      if(!body.id)return json(400,{error:'id required'});
      const status=body.status;
      if(!['reopened','closed'].includes(status))return json(400,{error:'status must be reopened or closed'});
      const patch=status==='reopened'?{status,reopened_by:ctx.user.id,reopened_at:new Date().toISOString(),reason:body.reason||'Period reopened through HFMS'}:{status,closed_by:ctx.user.id,closed_at:new Date().toISOString(),reason:body.reason||'Period reclosed through HFMS'};
      const {data,error}=await db.from('accounting_periods').update(patch).eq('id',body.id).eq('branch_id',branchId).select().single(); if(error)throw error; return json(200,{period:data});
    }
    return json(405,{error:'GET, POST or PATCH only'});
  }catch(e){return json(500,{error:e.message});}
};
