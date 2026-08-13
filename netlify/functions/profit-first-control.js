const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');
const ROLES=['owner','finance_manager','accountant','branch_manager'];
const APPROVERS=['owner','finance_manager','branch_manager'];
const VERIFIERS=['owner','finance_manager'];
const BUCKETS=['profit','owner_debt','tax','opex'];
const pctKeys={profit:'pct_profit',owner_debt:'pct_owner_debt',tax:'pct_tax',opex:'pct_opex'};
const n=v=>Number(v||0);
function periodDate(p){return /^\d{4}-\d{2}$/.test(p)?`${p}-01`:p;}
async function revenueFor(admin,branchId,period){
 const start=periodDate(period); const d=new Date(start); const end=new Date(d.getFullYear(),d.getMonth()+1,0).toISOString().slice(0,10);
 const {data,error}=await admin.from('financial_transactions').select('net_amount_kes').eq('branch_id',branchId).eq('transaction_type','revenue').eq('direction','inflow').eq('is_deleted',false).eq('classification_status','classified').gte('transaction_date',start).lte('transaction_date',end);
 if(error)throw error; return (data||[]).reduce((s,r)=>s+n(r.net_amount_kes),0);
}
exports.handler=async event=>{
 const admin=adminClient(); const method=event.httpMethod; let body={};
 if(method!=='GET'){try{body=JSON.parse(event.body||'{}')}catch(e){return json(400,{error:'Invalid JSON.'})}}
 const branchId=(method==='GET'?(event.queryStringParameters||{}).branch_id:body.branch_id);
 const ctx=await requireBranchAccess(event,requireUser,admin,branchId,{write:method!=='GET'}); if(ctx.error)return json(ctx.status,{error:ctx.error});
 try{
  if(method==='GET'){
   const q=event.queryStringParameters||{}; const period=q.period;
   const [s,a,p,c]=await Promise.all([
    admin.from('profit_first_settings').select('*').eq('branch_id',branchId).maybeSingle(),
    admin.from('allocations').select('*,allocation_proofs(*)').eq('branch_id',branchId).order('period',{ascending:false}).limit(120),
    admin.from('profit_first_cycles').select('*').eq('branch_id',branchId).order('period',{ascending:false}).limit(24),
    admin.from('profit_first_compliance').select('*').eq('branch_id',branchId).order('period',{ascending:false}).limit(24)
   ]); if(s.error||a.error||p.error||c.error)throw(s.error||a.error||p.error||c.error);
   return json(200,{settings:s.data,allocations:a.data||[],cycles:p.data||[],compliance:c.data||[],selected_period:period||null});
  }
  if(!ROLES.includes(ctx.role)&&!ctx.access.isHeadOffice)return json(403,{error:'Finance role required.'});
  if(body.action==='update_settings'){
   if(!APPROVERS.includes(ctx.role)&&!ctx.access.isHeadOffice)return json(403,{error:'Only management can change Profit First settings.'});
   const vals={}; for(const k of Object.values(pctKeys)){if(body[k]!==undefined)vals[k]=n(body[k]);}
   const total=BUCKETS.reduce((s,b)=>s+n(vals[pctKeys[b]]),0); if(Math.abs(total-100)>0.001)return json(400,{error:`Profit First percentages must total 100%. Current total: ${total}%.`});
   const {data:old}=await admin.from('profit_first_settings').select('*').eq('branch_id',branchId).maybeSingle();
   const patch={...vals,monthly_revenue_target_kes:n(body.monthly_revenue_target_kes),debt_paydown_split_pct:n(body.debt_paydown_split_pct),effective_from:body.effective_from||new Date().toISOString().slice(0,10),updated_by:ctx.user.id,updated_at:new Date().toISOString()};
   const {data,error}=await admin.from('profit_first_settings').upsert({branch_id:branchId,...patch},{onConflict:'branch_id'}).select().single(); if(error)throw error;
   await admin.from('profit_first_settings_history').insert({branch_id:branchId,config:data,reason:body.reason||'Profit First configuration change',changed_by:ctx.user.id});
   return json(200,{settings:data,previous:old});
  }
  if(body.action==='prepare_cycle'){
   if(!body.period)return json(400,{error:'period required'});
   const {data:settings,error:se}=await admin.from('profit_first_settings').select('*').eq('branch_id',branchId).single(); if(se)throw se;
   const revenue=await revenueFor(admin,branchId,body.period); const amounts={}; for(const b of BUCKETS)amounts[b]=Math.round(revenue*n(settings[pctKeys[b]])/100*100)/100;
   const total=Object.values(amounts).reduce((s,v)=>s+v,0); amounts.opex=Math.round((amounts.opex+(revenue-total))*100)/100;
   const rows=BUCKETS.map(bucket=>({branch_id:branchId,period:periodDate(body.period),bucket,amount_kes:amounts[bucket],computed_at:new Date().toISOString()}));
   const {data,error}=await admin.from('allocations').upsert(rows,{onConflict:'branch_id,period,bucket'}).select(); if(error)throw error;
   const {data:cycle,error:ce}=await admin.from('profit_first_cycles').upsert({branch_id:branchId,period:periodDate(body.period),revenue_kes:revenue,target_pct_total:100,status:'prepared',prepared_by:ctx.user.id,prepared_at:new Date().toISOString()},{onConflict:'branch_id,period'}).select().single(); if(ce)throw ce;
   return json(200,{cycle,allocations:data,settings});
  }
  if(body.action==='request_approval'){
   const period=periodDate(body.period); const {data:rows,error}=await admin.from('allocations').select('*').eq('branch_id',branchId).eq('period',period); if(error)throw error; if(!rows?.length)return json(404,{error:'No allocation prepared for this period.'});
   for(const a of rows) await admin.from('allocation_approvals').upsert({allocation_id:a.id,branch_id:branchId,status:'pending',requested_by:ctx.user.id,requested_at:new Date().toISOString()},{onConflict:'allocation_id'});
   await admin.from('profit_first_cycles').update({status:'pending_approval',requested_by:ctx.user.id,requested_at:new Date().toISOString()}).eq('branch_id',branchId).eq('period',period);
   return json(200,{status:'pending_approval'});
  }
  if(body.action==='approve_cycle'){
   if(!APPROVERS.includes(ctx.role)&&!ctx.access.isHeadOffice)return json(403,{error:'Only management can approve allocations.'});
   const period=periodDate(body.period); const {data:rows,error}=await admin.from('allocations').select('*').eq('branch_id',branchId).eq('period',period); if(error)throw error;
   for(const a of rows){await admin.from('allocations').update({approved_by:ctx.user.id,approved_at:new Date().toISOString()}).eq('id',a.id);await admin.from('allocation_approvals').upsert({allocation_id:a.id,branch_id:branchId,status:'approved',requested_by:ctx.user.id,reviewed_by:ctx.user.id,reviewed_at:new Date().toISOString(),reason:body.reason||null},{onConflict:'allocation_id'});}
   await admin.from('profit_first_cycles').update({status:'approved',approved_by:ctx.user.id,approved_at:new Date().toISOString()}).eq('branch_id',branchId).eq('period',period);
   return json(200,{status:'approved'});
  }
  if(body.action==='record_transfer'){
   const {data:a,error:ae}=await admin.from('allocations').select('*').eq('id',body.allocation_id).eq('branch_id',branchId).single(); if(ae)throw ae;
   if(!a.approved_at)return json(409,{error:'Allocation must be approved before transfer.'});
   const actual=n(body.actual_amount_kes); if(actual<=0)return json(400,{error:'Actual transfer amount must be greater than zero.'});
   const patch={transfer_status:'transferred',transfer_reference:body.transfer_reference||null,transferred_amount_kes:actual,transferred_at:new Date().toISOString(),transferred_by:ctx.user.id,variance_kes:n(a.amount_kes)-actual};
   const {data:u,error}=await admin.from('allocations').update(patch).eq('id',a.id).select().single(); if(error)throw error;
   if(body.from_account_id&&body.to_account_id){await admin.from('cash_movements').insert({branch_id:branchId,movement_date:body.transfer_date||new Date().toISOString().slice(0,10),movement_type:'profit_allocation',direction:'outflow',amount_kes:actual,from_account_id:body.from_account_id,to_account_id:body.to_account_id,source_ref:body.transfer_reference||null,description:`Profit First ${a.bucket} allocation`,reason:'Profit First allocation transfer',created_by:ctx.user.id});}
   return json(200,{allocation:u});
  }
  if(body.action==='submit_proof'){
   const {data:existing}=await admin.from('allocation_proofs').select('id').eq('allocation_id',body.allocation_id).in('proof_status',['pending','verified']).limit(1); if(existing&&existing.length)return json(409,{error:'A pending or verified proof already exists for this allocation.'});
   const {data:a,error:ae}=await admin.from('allocations').select('*').eq('id',body.allocation_id).eq('branch_id',branchId).single();if(ae)throw ae;
   if(a.transfer_status!=='transferred')return json(409,{error:'Record the actual transfer before submitting proof.'});
   const {data,error}=await admin.from('allocation_proofs').insert({branch_id:branchId,allocation_id:a.id,account_id:body.account_id||null,expected_amount_kes:a.amount_kes,actual_amount_kes:a.transferred_amount_kes,proof_reference:body.proof_reference||a.transfer_reference,proof_date:body.proof_date||new Date().toISOString().slice(0,10),proof_status:'pending',reason:body.reason||null,created_by:ctx.user.id}).select().single();if(error)throw error;
   return json(201,{proof:data});
  }
  if(body.action==='verify_proof'){
   if(!VERIFIERS.includes(ctx.role)&&!ctx.access.isHeadOffice)return json(403,{error:'Only Owner or Finance Manager can verify proof.'});
   const {data:p,error}=await admin.from('allocation_proofs').update({proof_status:body.status==='rejected'?'rejected':'verified',verified_by:ctx.user.id,verified_at:new Date().toISOString(),verification_note:body.note||null}).eq('id',body.proof_id).eq('branch_id',branchId).select().single();if(error)throw error;
   const {data:a}=await admin.from('allocations').select('*').eq('id',p.allocation_id).single(); if(p.proof_status==='verified')await admin.from('allocations').update({transfer_status:'verified'}).eq('id',p.allocation_id);
   return json(200,{proof:p,allocation:a});
  }
  if(body.action==='close_cycle'){
   if(!APPROVERS.includes(ctx.role)&&!ctx.access.isHeadOffice)return json(403,{error:'Only management can close a Profit First cycle.'});
   const period=periodDate(body.period); const {data:rows,error}=await admin.from('allocations').select('*,allocation_proofs(*)').eq('branch_id',branchId).eq('period',period);if(error)throw error;
   const incomplete=(rows||[]).filter(a=>a.transfer_status!=='verified'||!(a.allocation_proofs||[]).some(p=>p.proof_status==='verified'));
   if(incomplete.length)return json(409,{error:'Cycle cannot close until every allocation has a verified transfer proof.',incomplete:incomplete.map(x=>x.bucket)});
   await admin.from('profit_first_cycles').update({status:'closed',closed_by:ctx.user.id,closed_at:new Date().toISOString()}).eq('branch_id',branchId).eq('period',period);
   return json(200,{status:'closed'});
  }
  if(body.action==='score'){
   const period=periodDate(body.period); const {data:rows,error}=await admin.from('allocations').select('*,allocation_proofs(*)').eq('branch_id',branchId).eq('period',period);if(error)throw error;
   let target=0, transferred=0, verified=0, variance=0; for(const a of rows||[]){target+=n(a.amount_kes);transferred+=n(a.transferred_amount_kes);if(a.transfer_status==='verified')verified+=1;variance+=Math.abs(n(a.variance_kes));}
   const count=(rows||[]).length; const completion=count?verified/count*100:0; const transferRate=target?Math.min(100,transferred/target*100):0; const score=Math.round((completion*0.6+transferRate*0.4)*100)/100;
   const status=score>=95?'excellent':score>=80?'healthy':score>=60?'needs_attention':'at_risk';
   const coaching=score>=95?'Excellent Profit First discipline. Maintain verified transfers and protect allocated funds.':score>=80?'Good discipline. Close remaining proof gaps before the next allocation cycle.':score>=60?'Attention required: prioritize missing transfers and proof verification.':'At risk: review cash discipline and complete the current allocation cycle before discretionary operating spend.';
   const {data,error:ce}=await admin.from('profit_first_compliance').upsert({branch_id:branchId,period,score,status,target_kes:target,transferred_kes:transferred,verified_count:verified,allocation_count:count,variance_kes:variance,coaching_message:coaching,calculated_at:new Date().toISOString()},{onConflict:'branch_id,period'}).select().single();if(ce)throw ce;
   return json(200,{compliance:data});
  }
  return json(400,{error:'Unknown Profit First action.'});
 }catch(e){console.error(e);return json(500,{error:e.message||'Profit First control failed.'});}
};
