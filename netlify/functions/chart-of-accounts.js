const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');
exports.handler=async event=>{
 const method=event.httpMethod; const q=event.queryStringParameters||{}; let body={}; if(method!=='GET')body=JSON.parse(event.body||'{}');
 const branchId=q.branch_id||body.branch_id; const ctx=await requireBranchAccess(event,requireUser,adminClient(),branchId,{write:method!=='GET'}); if(ctx.error)return json(ctx.status,{error:ctx.error});
 const db=adminClient();
 try{
  if(method==='GET'){const {data,error}=await db.from('chart_of_accounts').select('*').eq('branch_id',branchId).eq('is_active',true).order('code');if(error)throw error;return json(200,{accounts:data||[]});}
  if(!['owner','finance_manager','accountant'].includes(ctx.role))return json(403,{error:'Only finance control roles may change the chart of accounts.'});
  if(method==='POST'){if(!body.code||!body.name||!body.account_type)return json(400,{error:'code, name and account_type are required'});const {data,error}=await db.from('chart_of_accounts').insert({branch_id:branchId,code:body.code,name:body.name,account_type:body.account_type,parent_id:body.parent_id||null,is_control:!!body.is_control}).select().single();if(error)throw error;return json(201,{account:data});}
  if(method==='PATCH'){if(!body.id)return json(400,{error:'id required'});const {data,error}=await db.from('chart_of_accounts').update({name:body.name,is_active:body.is_active}).eq('id',body.id).eq('branch_id',branchId).select().single();if(error)throw error;return json(200,{account:data});}
  return json(405,{error:'GET, POST or PATCH only'});
 }catch(e){return json(500,{error:e.message});}
};
