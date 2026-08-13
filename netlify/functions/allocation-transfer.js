const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');
exports.handler=async event=>{
 if(event.httpMethod!=='POST')return json(405,{error:'POST only'});
 let body={};try{body=JSON.parse(event.body||'{}')}catch(e){return json(400,{error:'Invalid JSON'});}
 const admin=adminClient(), branchId=body.branch_id; const ctx=await requireBranchAccess(event,requireUser,admin,branchId,{write:true}); if(ctx.error)return json(ctx.status,{error:ctx.error});
 if(!ctx.access.isHeadOffice&&!['owner','finance_manager','accountant'].includes(ctx.role))return json(403,{error:'Management or Accountant role required.'});
 try{
  const {data:a,error:ae}=await admin.from('allocations').select('*').eq('id',body.allocation_id).eq('branch_id',branchId).single();if(ae)throw ae;
  if(a.approved_at==null)return json(409,{error:'Allocation must be approved before transfer.'});
  const status=body.status||'transferred';
  if(!['pending','transferred','verified','rejected'].includes(status))return json(400,{error:'Invalid transfer status.'});
  const patch={transfer_status:status,transfer_reference:body.transfer_reference||a.transfer_reference||null,transferred_amount_kes:Number(body.actual_amount_kes||a.transferred_amount_kes||0),transferred_at:status==='pending'?null:new Date().toISOString(),transferred_by:status==='pending'?null:ctx.user.id};
  patch.variance_kes=Number(a.amount_kes||0)-Number(patch.transferred_amount_kes||0);
  const {data,error}=await admin.from('allocations').update(patch).eq('id',a.id).eq('branch_id',branchId).select().single();if(error)throw error;
  return json(200,{allocation:data});
 }catch(e){return json(500,{error:e.message});}
};
