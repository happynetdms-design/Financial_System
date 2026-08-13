const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');
const n=v=>Number(v||0);
const dateDiff=(a,b)=>Math.abs((new Date(a)-new Date(b))/86400000);

exports.handler=async event=>{
  if(!['POST','GET'].includes(event.httpMethod)) return json(405,{error:'GET or POST only'});
  const admin=adminClient();
  let body={}; try{body=JSON.parse(event.body||'{}')}catch(e){return json(400,{error:'Invalid JSON'});}
  const q=event.queryStringParameters||{};
  const branchId=body.branch_id||q.branch_id;
  const ctx=await requireBranchAccess(event,requireUser,admin,branchId,{write:event.httpMethod==='POST'});
  if(ctx.error) return json(ctx.status,{error:ctx.error});
  try{
    if(event.httpMethod==='GET'){
      const reconId=q.reconciliation_id;
      if(!reconId) return json(400,{error:'reconciliation_id is required'});
      const {data,error}=await admin.from('reconciliation_import_rows').select('*').eq('reconciliation_id',reconId).order('external_date');
      if(error) throw error;
      return json(200,{rows:data||[]});
    }
    const reconId=body.reconciliation_id;
    const rows=Array.isArray(body.rows)?body.rows:[];
    if(!reconId||!rows.length) return json(400,{error:'reconciliation_id and rows are required'});
    const {data:recon,error:re}=await admin.from('cash_reconciliations').select('id,branch_id').eq('id',reconId).eq('branch_id',branchId).single();
    if(re) throw re;
    const {data:tx,error:te}=await admin.from('financial_transactions')
      .select('id,transaction_date,direction,net_amount_kes,source_ref,description,counterparty')
      .eq('branch_id',branchId).eq('is_deleted',false).eq('classification_status','classified');
    if(te) throw te;
    const existingRefs=new Set();
    const inserts=[];
    for(const r of rows){
      const extDate=String(r.date||r.external_date||'').slice(0,10);
      const amount=Math.abs(n(r.amount||r.external_amount));
      const direction=String(r.direction||r.external_direction||'').toLowerCase()==='out'?'out':'in';
      const ref=String(r.reference||r.external_reference||'').trim()||null;
      const desc=String(r.description||r.external_description||'').trim();
      let best=null,bestScore=0;
      for(const t of tx||[]){
        if(t.direction!==direction || Math.abs(n(t.net_amount_kes)-amount)>0.01) continue;
        const days=dateDiff(extDate,t.transaction_date); if(days>3) continue;
        let score=0.7-(days*0.15);
        if(ref && t.source_ref && ref.toLowerCase()===String(t.source_ref).toLowerCase()) score+=0.3;
        if(desc && t.description && String(t.description).toLowerCase().includes(desc.toLowerCase().slice(0,20))) score+=0.05;
        if(score>bestScore){bestScore=score;best=t;}
      }
      inserts.push({reconciliation_id:recon.id,external_reference:ref,external_date:extDate||null,external_description:desc||null,external_amount:amount,external_direction:direction,matched_transaction_id:best?.id||null,match_score:best?Math.min(1,bestScore):0,match_status:best?'matched':'unmatched'});
    }
    const {data,error}=await admin.from('reconciliation_import_rows').insert(inserts).select();
    if(error) throw error;
    return json(201,{rows:data||[],matched:(data||[]).filter(x=>x.match_status==='matched').length,unmatched:(data||[]).filter(x=>x.match_status==='unmatched').length});
  }catch(e){return json(500,{error:e.message});}
};
