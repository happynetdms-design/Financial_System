const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');
exports.handler=async event=>{
  const method=event.httpMethod; const q=event.queryStringParameters||{}; let body={}; if(method!=='GET') try{body=JSON.parse(event.body||'{}')}catch{return json(400,{error:'Invalid JSON'});}
  const branchId=q.branch_id||body.branch_id; if(!branchId)return json(400,{error:'branch_id required'});
  const ctx=await requireBranchAccess(event,requireUser,adminClient(),branchId,{write:method!=='GET'}); if(ctx.error)return json(ctx.status,{error:ctx.error});
  if(method==='GET'){const {data,error}=await adminClient().from('hfms_opening_balances').select('*,account:chart_of_accounts(code,name,account_type)').eq('branch_id',branchId).order('created_at');if(error)return json(500,{error:error.message});return json(200,{balances:data||[]});}
  if(!['owner','finance_manager','accountant'].includes(ctx.role))return json(403,{error:'Finance control role required'});
  const {account_id,amount_kes,effective_date,reason}=body;if(!account_id||!effective_date||amount_kes===undefined||!reason)return json(400,{error:'account_id, amount_kes, effective_date and reason are required'});
  const {data,error}=await adminClient().from('hfms_opening_balances').insert({branch_id:branchId,account_id,amount_kes,effective_date,reason,created_by:ctx.user.id}).select().single();if(error)return json(400,{error:error.message});return json(201,{balance:data});
};
