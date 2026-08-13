const { requireUser, adminClient, json } = require('./_lib/supabase');
const { getAccess } = require('./_lib/rbac');
exports.handler=async event=>{
 if(event.httpMethod!=='GET')return json(405,{error:'GET only'});
 const admin=adminClient(); const {user,error}=await requireUser(event); if(error)return json(401,{error});
 try{
  const access=await getAccess(admin,user.id); if(!access.isHeadOffice)return json(403,{error:'Head Office access required.'});
  const checks=[];
  checks.push({control:'authenticated_user',status:'PASS'});
  checks.push({control:'head_office_branch_access',status:'PASS'});
  const tables=['financial_transactions','cash_movements','cash_reconciliations','allocation_approvals','allocation_proofs','audit_log'];
  for(const table of tables){const {error:e}=await admin.from(table).select('id',{head:true,count:'exact'}).limit(1);checks.push({control:`table:${table}`,status:e?'FAIL':'PASS',detail:e?.message||null});}
  return json(200,{generated_at:new Date().toISOString(),checks,pass_rate:Math.round(checks.filter(c=>c.status==='PASS').length/checks.length*100)});
 }catch(e){return json(500,{error:e.message});}
};
