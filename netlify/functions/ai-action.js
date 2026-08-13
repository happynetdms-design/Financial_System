const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');

function allowedRole(role, action){
  const high=['post_journal','reverse_journal','record_profit_first_transfer','close_period','change_profit_first_settings','approve_allocation'];
  if(high.includes(action)) return ['owner','finance_manager','accountant'].includes(role);
  return ['owner','finance_manager','accountant','branch_manager'].includes(role);
}

exports.handler=async(event)=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed.'});
  const admin=adminClient(); let b;try{b=JSON.parse(event.body||'{}')}catch{return json(400,{error:'Invalid JSON.'})}
  const {branch_id:branchId,action_id:actionId,confirm=false}=b;
  const auth=await requireUser(event);if(auth.error)return json(401,{error:auth.error});
  const {data:action,error}=await admin.from('ai_action_requests').select('*').eq('id',actionId).eq('branch_id',branchId).maybeSingle();
  if(error||!action)return json(404,{error:'Action request not found.'});
  if(action.status!=='awaiting_confirmation')return json(409,{error:`Action is ${action.status}.`});
  const access=await requireBranchAccess(event, requireUser, admin, branchId,{write:true});if(access.error)return json(access.status,{error:access.error});
  const role=(access.role||access.user_role||'').toLowerCase(); if(!allowedRole(role,action.action_type))return json(403,{error:'Your role is not authorized to execute this AI-proposed action.'});
  if(!confirm){await admin.from('ai_action_requests').update({status:'cancelled'}).eq('id',actionId);return json(200,{status:'cancelled'});}

  // Phase 15 deliberately executes only safe workflow actions. Money movement remains
  // behind the existing specialized endpoints and must still pass their own controls.
  let result={status:'confirmed',action_type:action.action_type};
  if(action.action_type==='create_financial_recommendation'){
    const p=action.action_payload||{};
    const {data:r,error:e}=await admin.from('financial_recommendations').insert({branch_id:branchId,created_by:access.user.id,recommendation_type:p.type||'ai',title:p.title||'AI Recommendation',evidence:p.evidence||{},recommendation:p.recommendation||'',expected_impact:p.expected_impact||{}}).select().single();
    if(e)throw e; result={...result,recommendation_id:r.id};
  } else if(action.action_type==='create_report'){
    result={...result,report:action.action_payload||{}};
  } else if(action.action_type==='create_draft_journal'){
    result={...result,requires_manual_post:true,draft:action.action_payload||{}};
  } else {
    // Unknown/financial mutation actions are never executed generically.
    return json(422,{error:'This AI action requires the dedicated financial control workflow. No ledger mutation was performed.'});
  }
  await admin.from('ai_action_requests').update({status:'executed',confirmed_at:new Date().toISOString(),executed_at:new Date().toISOString(),execution_result:result}).eq('id',actionId);
  return json(200,result);
};
