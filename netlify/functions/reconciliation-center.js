const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');

const n = v => Number(v || 0);
const norm = v => String(v == null ? '' : v).trim();
const d = v => norm(v).slice(0,10);
const dayDiff = (a,b) => Math.abs((new Date(a)-new Date(b))/86400000);
const amountClose = (a,b,t=.01) => Math.abs(n(a)-n(b)) <= t;
const hash = row => [d(row.date||row.external_date),n(row.amount||row.external_amount).toFixed(2),norm(row.direction||row.external_direction).toLowerCase(),norm(row.reference||row.external_reference).toLowerCase(),norm(row.description||row.external_description).toLowerCase()].join('|');

function roleCanApprove(role){ return ['owner','finance_manager'].includes(role); }
function roleCanWrite(role){ return ['owner','finance_manager','branch_manager','accountant'].includes(role); }

async function ledgerBalance(admin, branchId, accountId, from, to, opening=0){
  let q = admin.from('financial_transactions').select('direction,net_amount_kes,transaction_date,account_id').eq('branch_id',branchId).eq('is_deleted',false).eq('classification_status','classified').gte('transaction_date',from).lte('transaction_date',to);
  if(accountId) q=q.eq('account_id',accountId);
  const {data,error}=await q;
  if(error) throw error;
  return n(opening)+(data||[]).reduce((s,t)=>s+(t.direction==='in'?n(t.net_amount_kes):-n(t.net_amount_kes)),0);
}

async function logEvent(admin, reconciliationId, actorId, type, data={}){
  await admin.from('reconciliation_audit_events').insert({reconciliation_id:reconciliationId,event_type:type,event_data:data,actor_id:actorId});
}

exports.handler = async event => {
  const method = event.httpMethod;
  if(!['GET','POST','PATCH'].includes(method)) return json(405,{error:'GET, POST or PATCH only'});
  const admin = adminClient();
  let body={}; try{body=JSON.parse(event.body||'{}')}catch(e){return json(400,{error:'Invalid JSON'});}
  const q=event.queryStringParameters||{};
  const branchId=body.branch_id||q.branch_id;
  const ctx=await requireBranchAccess(event,requireUser,admin,branchId,{write:method!=='GET'});
  if(ctx.error) return json(ctx.status,{error:ctx.error});

  try{
    if(method==='GET'){
      const id=q.reconciliation_id;
      if(!id) return json(400,{error:'reconciliation_id is required'});
      const {data:re,error:reErr}=await admin.from('cash_reconciliations').select('*').eq('id',id).eq('branch_id',branchId).single();
      if(reErr) throw reErr;
      const [rowsRes,matchRes,excRes,auditRes]=await Promise.all([
        admin.from('reconciliation_import_rows').select('*').eq('reconciliation_id',id).order('source_row_number'),
        admin.from('hfms_reconciliation_matches').select('*').eq('reconciliation_id',id).order('matched_at'),
        admin.from('reconciliation_exceptions').select('*').eq('reconciliation_id',id).order('created_at',{ascending:false}),
        admin.from('reconciliation_audit_events').select('*').eq('reconciliation_id',id).order('created_at',{ascending:false}).limit(100)
      ]);
      for(const r of [rowsRes,matchRes,excRes,auditRes]) if(r.error) throw r.error;
      const rows=rowsRes.data||[];
      const summary={statementRows:rows.length,matched:rows.filter(x=>['matched','manual'].includes(x.match_status)).length,unmatched:rows.filter(x=>x.match_status==='unmatched').length,excluded:rows.filter(x=>x.match_status==='excluded').length,openExceptions:(excRes.data||[]).filter(x=>x.status==='open').length};
      return json(200,{reconciliation:re,rows,matches:matchRes.data||[],exceptions:excRes.data||[],audit:auditRes.data||[],summary});
    }

    const action=body.action||method.toLowerCase();
    if(action==='create'){
      if(!body.period_start||!body.period_end||!body.account_id) return json(400,{error:'account_id, period_start and period_end are required'});
      if(body.period_end<body.period_start) return json(400,{error:'period_end cannot be before period_start'});
      const {data:account,error:ae}=await admin.from('financial_accounts').select('id,name').eq('id',body.account_id).eq('branch_id',branchId).single();
      if(ae) throw ae;
      const opening=n(body.opening_statement_balance);
      const ledger=await ledgerBalance(admin,branchId,body.account_id,body.period_start,body.period_end,opening);
      const {data,error}=await admin.from('cash_reconciliations').insert({branch_id:branchId,account_id:body.account_id,account_name:account.name,period_start:body.period_start,period_end:body.period_end,statement_balance:n(body.statement_balance),ledger_balance:ledger,opening_statement_balance:opening,closing_statement_balance:n(body.statement_balance),tolerance_kes:n(body.tolerance_kes)||0.01,statement_source:body.statement_source||'manual',statement_file_name:body.statement_file_name||null,notes:body.notes||null,prepared_by:ctx.user.id,created_by:ctx.user.id}).select().single();
      if(error) throw error;
      await logEvent(admin,data.id,ctx.user.id,'created',{ledger_balance:ledger,statement_balance:n(body.statement_balance)});
      return json(201,{reconciliation:data});
    }

    const id=body.reconciliation_id||body.id;
    if(!id) return json(400,{error:'reconciliation_id is required'});
    const {data:re,error:reErr}=await admin.from('cash_reconciliations').select('*').eq('id',id).eq('branch_id',branchId).single();
    if(reErr) throw reErr;
    if(re.status==='approved' || re.locked_at) return json(409,{error:'This reconciliation is locked because it has been approved.'});

    if(action==='import_rows'){
      const rows=Array.isArray(body.rows)?body.rows:[];
      if(!rows.length) return json(400,{error:'rows are required'});
      const existing=await admin.from('reconciliation_import_rows').select('source_hash').eq('reconciliation_id',id);
      if(existing.error) throw existing.error;
      const seen=new Set((existing.data||[]).map(x=>x.source_hash).filter(Boolean));
      const inserts=[]; let duplicates=0;
      rows.forEach((r,i)=>{
        const direction=norm(r.direction||r.external_direction).toLowerCase();
        const amount=Math.abs(n(r.amount||r.external_amount));
        const rowHash=norm(r.source_hash)||hash(r);
        if(!d(r.date||r.external_date)||!amount || !['in','out','inflow','outflow'].includes(direction)) return;
        if(seen.has(rowHash)){duplicates++;return;}
        seen.add(rowHash);
        inserts.push({reconciliation_id:id,source_row_number:Number(r.row_number||r.source_row_number||i+1),external_reference:norm(r.reference||r.external_reference)||null,external_date:d(r.date||r.external_date),external_description:norm(r.description||r.external_description)||null,external_amount:amount,external_direction:(direction==='inflow'?'in':direction==='outflow'?'out':direction),external_balance:r.balance==null&&r.external_balance==null?null:n(r.balance||r.external_balance),source_hash:rowHash,match_status:'unmatched'});
      });
      if(inserts.length){const ins=await admin.from('reconciliation_import_rows').insert(inserts).select();if(ins.error)throw ins.error;}
      await logEvent(admin,id,ctx.user.id,'statement_imported',{received:rows.length,inserted:inserts.length,duplicates});
      return json(201,{inserted:inserts.length,duplicates,invalid:rows.length-inserts.length-duplicates});
    }

    if(action==='suggest_matches'){
      const {data:rows,error:rr}=await admin.from('reconciliation_import_rows').select('*').eq('reconciliation_id',id).eq('match_status','unmatched'); if(rr) throw rr;
      const {data:tx,error:te}=await admin.from('financial_transactions').select('id,transaction_date,direction,net_amount_kes,source_ref,external_ref,description,counterparty,account_id').eq('branch_id',branchId).eq('is_deleted',false).eq('classification_status','classified').gte('transaction_date',re.period_start).lte('transaction_date',re.period_end).eq('account_id',re.account_id); if(te) throw te;
      const used=new Set();
      const suggestions=[];
      for(const row of rows){
        let best=null,bestScore=0;
        for(const t of tx||[]){
          if(used.has(t.id) || t.direction!==row.external_direction) continue;
          const diff=Math.abs(n(t.net_amount_kes)-n(row.external_amount)); if(diff>Math.max(0.01,n(body.amount_tolerance)||0.01)) continue;
          const days=dayDiff(row.external_date,t.transaction_date); if(days>body.date_window_days && body.date_window_days!=null) continue;
          let score=0.55;
          if(amountClose(t.net_amount_kes,row.external_amount)) score+=0.25;
          if(days===0) score+=0.12; else if(days<=1) score+=0.08; else if(days<=3) score+=0.04;
          const ref=(row.external_reference||'').toLowerCase(); const tr=(t.source_ref||t.external_ref||'').toLowerCase();
          if(ref && tr && ref===tr) score+=0.20;
          const desc=(row.external_description||'').toLowerCase(); const td=((t.description||'')+' '+(t.counterparty||'')).toLowerCase();
          if(desc && td && (td.includes(desc.slice(0,18))||desc.includes(td.slice(0,18)))) score+=0.08;
          if(score>bestScore){bestScore=score;best=t;}
        }
        if(best){used.add(best.id); suggestions.push({row_id:row.id,transaction_id:best.id,score:Math.min(1,bestScore),confidence:bestScore>=0.9?'high':bestScore>=0.72?'medium':'low'});}
      }
      for(const s of suggestions) await admin.from('reconciliation_import_rows').update({candidate_transaction_id:s.transaction_id,match_score:s.score}).eq('id',s.row_id).eq('reconciliation_id',id);
      await logEvent(admin,id,ctx.user.id,'match_suggestions_generated',{count:suggestions.length});
      return json(200,{suggestions});
    }

    if(action==='match'){
      const rowId=body.external_row_id||body.row_id, txId=body.financial_transaction_id||body.transaction_id;
      if(!rowId||!txId) return json(400,{error:'external_row_id and financial_transaction_id are required'});
      const {data:row,error:rowErr}=await admin.from('reconciliation_import_rows').select('*').eq('id',rowId).eq('reconciliation_id',id).single(); if(rowErr) throw rowErr;
      const {data:tx,error:txErr}=await admin.from('financial_transactions').select('*').eq('id',txId).eq('branch_id',branchId).single(); if(txErr) throw txErr;
      if(row.match_status==='excluded') return json(409,{error:'Excluded statement rows must be restored before matching.'});
      if(tx.direction!==row.external_direction) return json(400,{error:'Direction mismatch between statement row and ledger transaction.'});
      const matchAmount=body.matched_amount==null?Math.min(n(row.external_amount),n(tx.net_amount_kes)):n(body.matched_amount);
      if(matchAmount<=0 || matchAmount>n(row.external_amount) || matchAmount>n(tx.net_amount_kes)) return json(400,{error:'Invalid matched amount.'});
      const difference=n(row.external_amount)-matchAmount;
      const {data:dup}=await admin.from('hfms_reconciliation_matches').select('id').eq('external_row_id',rowId).eq('financial_transaction_id',txId).maybeSingle();
      if(dup) return json(409,{error:'This statement row and ledger transaction are already matched.'});
      const type=amountClose(row.external_amount,tx.net_amount_kes,0.01)?'manual':'partial';
      const ins=await admin.from('hfms_reconciliation_matches').insert({reconciliation_id:id,external_row_id:rowId,financial_transaction_id:txId,matched_amount_kes:matchAmount,difference_kes:difference,match_type:type,reason:body.reason||null,matched_by:ctx.user.id}).select().single(); if(ins.error) throw ins.error;
      const nextStatus=difference<=0.01?'manual':'manual';
      await admin.from('reconciliation_import_rows').update({matched_transaction_id:txId,candidate_transaction_id:null,match_status:nextStatus,reviewed_by:ctx.user.id,reviewed_at:new Date().toISOString(),review_reason:body.reason||null}).eq('id',rowId);
      if(difference>0.01){await admin.from('reconciliation_exceptions').insert({reconciliation_id:id,import_row_id:rowId,exception_type:'amount_difference',severity:'warning',amount_kes:difference,description:`Statement amount differs from matched ledger amount by KES ${difference.toFixed(2)}.`});}
      await logEvent(admin,id,ctx.user.id,'manual_match',{row_id:rowId,transaction_id:txId,matched_amount:matchAmount,difference});
      return json(200,{match:ins.data});
    }

    if(action==='unmatch'){
      const rowId=body.external_row_id||body.row_id;
      if(!rowId) return json(400,{error:'external_row_id is required'});
      const del=await admin.from('hfms_reconciliation_matches').delete().eq('reconciliation_id',id).eq('external_row_id',rowId); if(del.error) throw del.error;
      const up=await admin.from('reconciliation_import_rows').update({matched_transaction_id:null,match_status:'unmatched',reviewed_by:null,reviewed_at:null}).eq('id',rowId).eq('reconciliation_id',id); if(up.error) throw up.error;
      await logEvent(admin,id,ctx.user.id,'unmatched',{row_id:rowId});
      return json(200,{ok:true});
    }

    if(action==='exclude'){
      const rowId=body.external_row_id||body.row_id;
      if(!rowId||!norm(body.reason)) return json(400,{error:'external_row_id and reason are required'});
      await admin.from('hfms_reconciliation_matches').delete().eq('reconciliation_id',id).eq('external_row_id',rowId);
      const up=await admin.from('reconciliation_import_rows').update({matched_transaction_id:null,match_status:'excluded',excluded_reason:body.reason,reviewed_by:ctx.user.id,reviewed_at:new Date().toISOString()}).eq('id',rowId).eq('reconciliation_id',id); if(up.error) throw up.error;
      await logEvent(admin,id,ctx.user.id,'row_excluded',{row_id:rowId,reason:body.reason});
      return json(200,{ok:true});
    }

    if(action==='resolve_exception'){
      if(!body.exception_id||!norm(body.resolution)) return json(400,{error:'exception_id and resolution are required'});
      const status=body.status==='waived'?'waived':'resolved';
      const up=await admin.from('reconciliation_exceptions').update({status,resolution:body.resolution,resolved_by:ctx.user.id,resolved_at:new Date().toISOString()}).eq('id',body.exception_id).eq('reconciliation_id',id); if(up.error) throw up.error;
      await logEvent(admin,id,ctx.user.id,'exception_resolved',{exception_id:body.exception_id,status,resolution:body.resolution});
      return json(200,{ok:true});
    }

    if(action==='submit'){
      if(!roleCanWrite(ctx.role)) return json(403,{error:'You are not authorized to submit reconciliations.'});
      const {data:rows,error:rr}=await admin.from('reconciliation_import_rows').select('match_status').eq('reconciliation_id',id); if(rr) throw rr;
      const {data:exc,error:ee}=await admin.from('reconciliation_exceptions').select('status').eq('reconciliation_id',id); if(ee) throw ee;
      const unmatched=(rows||[]).filter(x=>x.match_status==='unmatched').length;
      const open=(exc||[]).filter(x=>x.status==='open').length;
      if(unmatched>0 || open>0) return json(409,{error:`Cannot submit while ${unmatched} statement row(s) remain unmatched and ${open} exception(s) remain open.`});
      const {data:update,error}=await admin.from('cash_reconciliations').update({status:'submitted',submitted_by:ctx.user.id,submitted_at:new Date().toISOString()}).eq('id',id).eq('branch_id',branchId).select().single(); if(error) throw error;
      await logEvent(admin,id,ctx.user.id,'submitted',{});
      return json(200,{reconciliation:update});
    }

    if(action==='approve' || action==='reject'){
      if(!roleCanApprove(ctx.role)) return json(403,{error:'Only Owner or Finance Manager can approve or reject a reconciliation.'});
      if(action==='reject' && !norm(body.reason)) return json(400,{error:'A rejection reason is required.'});
      const patch=action==='approve'?{status:'approved',approved_by:ctx.user.id,approved_at:new Date().toISOString(),locked_at:new Date().toISOString(),locked_by:ctx.user.id}:{status:'rejected',rejected_by:ctx.user.id,rejected_at:new Date().toISOString(),rejection_reason:body.reason};
      const {data:update,error}=await admin.from('cash_reconciliations').update(patch).eq('id',id).eq('branch_id',branchId).select().single(); if(error) throw error;
      await logEvent(admin,id,ctx.user.id,action==='approve'?'approved':'rejected',action==='approve'?{}:{reason:body.reason});
      return json(200,{reconciliation:update});
    }

    if(action==='refresh_ledger'){
      const ledger=await ledgerBalance(admin,branchId,re.account_id,re.period_start,re.period_end,re.opening_statement_balance);
      const {data:update,error}=await admin.from('cash_reconciliations').update({ledger_balance:ledger}).eq('id',id).eq('branch_id',branchId).select().single(); if(error) throw error;
      await logEvent(admin,id,ctx.user.id,'ledger_refreshed',{ledger_balance:ledger});
      return json(200,{reconciliation:update});
    }

    return json(400,{error:'Unknown reconciliation action'});
  }catch(e){
    console.error('reconciliation-center',e);
    return json(500,{error:e.message||'Reconciliation operation failed'});
  }
};
