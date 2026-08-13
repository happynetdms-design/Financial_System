const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');
const n=v=>Number(v||0);
const allowed=['owner','finance_manager','accountant'];
exports.handler=async event=>{
 const admin=adminClient(); let body={};
 try{ if(event.httpMethod!=='GET') body=JSON.parse(event.body||'{}'); }catch(e){return json(400,{error:'Invalid JSON body'});}
 const q=event.queryStringParameters||{}; const branchId=body.branch_id||q.branch_id;
 const ctx=await requireBranchAccess(event,requireUser,admin,branchId,{write:event.httpMethod!=='GET'}); if(ctx.error)return json(ctx.status,{error:ctx.error});
 if(event.httpMethod!=='GET' && !ctx.access.isHeadOffice && !allowed.includes(ctx.role)) return json(403,{error:'Accountant or management role required.'});
 try{
  if(event.httpMethod==='GET'){
   const {data,error}=await admin.from('journal_entries').select('*,journal_lines(*)').eq('branch_id',branchId).order('entry_date',{ascending:false}).limit(100);
   if(error)throw error; return json(200,{entries:data||[]});
  }
  if(event.httpMethod==='POST'){
   const lines=Array.isArray(body.lines)?body.lines:[]; if(!body.entry_date||!body.description||lines.length<2)return json(400,{error:'entry_date, description and at least two lines are required.'});
   const totalD=lines.reduce((s,l)=>s+n(l.debit_kes),0), totalC=lines.reduce((s,l)=>s+n(l.credit_kes),0);
   if(Math.abs(totalD-totalC)>0.01 || totalD<=0)return json(400,{error:'Journal entry must balance and contain a positive debit total.'});
   const {data:closed}=await admin.rpc('hfms_period_is_closed',{p_branch:branchId,p_date:body.entry_date}); if(closed)return json(409,{error:'Accounting period is closed for this date.'});
   const {data:entry,error:ee}=await admin.from('journal_entries').insert({branch_id:branchId,entry_date:body.entry_date,description:body.description,reference:body.reference||null,status:'posted',source_type:body.source_type||'manual',source_id:body.source_id||null}).select().single();
   if(ee)throw ee;
   const payload=lines.map(l=>({journal_entry_id:entry.id,account_id:l.account_id,debit_kes:n(l.debit_kes),credit_kes:n(l.credit_kes),memo:l.memo||null}));
   const {data:jl,error:le}=await admin.from('journal_lines').insert(payload).select();
   if(le){await admin.from('journal_entries').delete().eq('id',entry.id); throw le;}
   return json(201,{entry:{...entry,journal_lines:jl}});
  }
  if(event.httpMethod==='PATCH'){
   if(body.action!=='reverse'||!body.id||!body.reason)return json(400,{error:'id, reason and action=reverse are required.'});
   const {data:orig,error:oe}=await admin.from('journal_entries').select('*,journal_lines(*)').eq('id',body.id).eq('branch_id',branchId).single(); if(oe)throw oe;
   if(orig.reversal_of)return json(409,{error:'This journal entry is already a reversal.'});
   const {data:existing}=await admin.from('journal_entries').select('id').eq('reversal_of',orig.id).maybeSingle(); if(existing)return json(409,{error:'A reversal already exists for this entry.'});
   const {data:closed}=await admin.rpc('hfms_period_is_closed',{p_branch:branchId,p_date:body.reversal_date||new Date().toISOString().slice(0,10)}); if(closed)return json(409,{error:'Reversal date is in a closed period.'});
   const {data:rev,error:re}=await admin.from('journal_entries').insert({branch_id:branchId,entry_date:body.reversal_date||new Date().toISOString().slice(0,10),description:`Reversal: ${orig.description}`,reference:body.reference||orig.reference,status:'posted',source_type:'reversal',source_id:orig.id,reversal_of:orig.id,reversal_reason:body.reason}).select().single(); if(re)throw re;
   const revLines=(orig.journal_lines||[]).map(l=>({journal_entry_id:rev.id,account_id:l.account_id,debit_kes:n(l.credit_kes),credit_kes:n(l.debit_kes),memo:`Reversal of ${orig.id}`}));
   const {data:rl,error:rle}=await admin.from('journal_lines').insert(revLines).select(); if(rle)throw rle;
   return json(201,{reversal:{...rev,journal_lines:rl}});
  }
  return json(405,{error:'GET, POST or PATCH only'});
 }catch(e){console.error(e);return json(500,{error:e.message||'Journal operation failed'});}
};
