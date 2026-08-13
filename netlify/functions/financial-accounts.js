const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');
exports.handler=async event=>{
 if(event.httpMethod!=='GET') return json(405,{error:'GET only'});
 const q=event.queryStringParameters||{}; const branchId=q.branch_id; const admin=adminClient();
 const ctx=await requireBranchAccess(event,requireUser,admin,branchId,{write:false}); if(ctx.error)return json(ctx.status,{error:ctx.error});
 const {data,error}=await admin.from('financial_accounts').select('id,name,kind,is_active').eq('branch_id',branchId).eq('is_active',true).order('name');
 if(error)return json(500,{error:error.message}); return json(200,{accounts:data||[]});
};
