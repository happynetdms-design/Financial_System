const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');
exports.handler=async event=>{
 if(event.httpMethod!=='GET')return json(405,{error:'GET only'});
 const q=event.queryStringParameters||{}; const branchId=q.branch_id;
 const ctx=await requireBranchAccess(event,requireUser,adminClient(),branchId,{write:false}); if(ctx.error)return json(ctx.status,{error:ctx.error});
 const db=adminClient();
 try{
  const {data,error}=await db.from('v_hfms_trial_balance').select('*').eq('branch_id',branchId).order('code'); if(error)throw error;
  const rows=data||[]; const debit=rows.reduce((s,r)=>s+Number(r.total_debit_kes||0),0); const credit=rows.reduce((s,r)=>s+Number(r.total_credit_kes||0),0);
  return json(200,{rows,total_debit_kes:debit,total_credit_kes:credit,balanced:Math.abs(debit-credit)<0.005});
 }catch(e){return json(500,{error:e.message});}
};
