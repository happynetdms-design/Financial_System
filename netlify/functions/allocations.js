const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');

const BUCKETS = ['profit', 'owner_debt', 'tax', 'opex'];

exports.handler = async (event) => {
  const admin = adminClient();
  const method = event.httpMethod;

  let body = {};
  if(method !== 'GET'){
    try{ body = JSON.parse(event.body || '{}'); }
    catch(e){ return json(400, { error: 'Invalid JSON body.' }); }
  }
  const branchId = method === 'GET'
    ? (event.queryStringParameters || {}).branch_id
    : body.branch_id;

  const ctx = await requireBranchAccess(event, requireUser, admin, branchId, { write: method !== 'GET' });
  if(ctx.error) return json(ctx.status, { error: ctx.error });

  try{
    if(method === 'GET'){
      const { period } = event.queryStringParameters || {};
      let q = admin.from('allocations').select('*,allocation_proofs(*)').eq('branch_id', branchId);
      if(period) q = q.eq('period', period);
      const { data, error } = await q.order('period', { ascending: false });
      if(error) return json(500, { error: error.message });
      return json(200, { allocations: data });
    }

    if(method === 'POST'){
      // Records/overwrites the computed allocation for each bucket in a
      // period. The frontend does the Profit First math (revenue x each
      // percentage from profit_first_settings); this endpoint just persists
      // the result as the auditable "proof" record.
      if(!body.period || !Array.isArray(body.buckets)){
        return json(400, { error: 'period and buckets[] are required.' });
      }
      for(const b of body.buckets){
        if(!BUCKETS.includes(b.bucket) || b.amount_kes === undefined){
          return json(400, { error: `Each bucket needs a valid name (${BUCKETS.join(', ')}) and amount_kes.` });
        }
      }
      const rows = body.buckets.map(b => ({
        branch_id: branchId,
        period: body.period,
        bucket: b.bucket,
        amount_kes: b.amount_kes,
        computed_at: new Date().toISOString()
      }));
      const { data, error } = await admin
        .from('allocations')
        .upsert(rows, { onConflict: 'branch_id,period,bucket' })
        .select();
      if(error) return json(500, { error: error.message });
      return json(200, { allocations: data });
    }

    if(method === 'PATCH'){
      if(!body.id) return json(400, { error: 'id is required.' });
      if(body.action === 'approve'){
        const APPROVER_ROLES=['owner','finance_manager','branch_manager'];
        if(!ctx.access.isHeadOffice && !APPROVER_ROLES.includes(ctx.role)) return json(403,{error:'Only management can approve allocations.'});
        const { data, error } = await admin.from('allocations').update({ approved_by:ctx.user.id, approved_at:new Date().toISOString(), proof_note:body.proof_note||null }).eq('id',body.id).eq('branch_id',branchId).select().maybeSingle();
        if(error) return json(500,{error:error.message}); if(!data)return json(404,{error:'Allocation not found.'});
        await admin.from('allocation_approvals').upsert({allocation_id:data.id,branch_id:branchId,status:'approved',requested_by:ctx.user.id,reviewed_by:ctx.user.id,reviewed_at:new Date().toISOString(),reason:body.reason||null},{onConflict:'allocation_id'});
        return json(200,{allocation:data});
      }
      if(body.action === 'verify_proof'){
        const VERIFY_ROLES=['owner','finance_manager'];
        if(!ctx.access.isHeadOffice && !VERIFY_ROLES.includes(ctx.role)) return json(403,{error:'Only Owner or Finance Manager can verify allocation proof.'});
        const {data,error}=await admin.from('allocation_proofs').update({proof_status:body.status==='rejected'?'rejected':'verified',verified_by:ctx.user.id,verified_at:new Date().toISOString(),verification_note:body.verification_note||null}).eq('id',body.proof_id).eq('branch_id',branchId).select().maybeSingle();
        if(error)return json(500,{error:error.message}); if(!data)return json(404,{error:'Proof not found.'}); return json(200,{proof:data});
      }
      if(body.action === 'proof'){
        const { data:allocation, error:ae }=await admin.from('allocations').select('*').eq('id',body.id).eq('branch_id',branchId).maybeSingle();
        if(ae) return json(500,{error:ae.message}); if(!allocation)return json(404,{error:'Allocation not found.'});
        const {data,error}=await admin.from('allocation_proofs').insert({branch_id:branchId,allocation_id:allocation.id,account_id:body.account_id||null,expected_amount_kes:allocation.amount_kes,actual_amount_kes:body.actual_amount_kes||0,proof_reference:body.proof_reference||null,proof_date:body.proof_date||new Date().toISOString().slice(0,10),proof_status:'pending',reason:body.reason||null,created_by:ctx.user.id}).select().maybeSingle();
        if(error)return json(500,{error:error.message}); return json(201,{proof:data});
      }
      const { data, error } = await admin.from('allocations').update({ proof_note: body.proof_note || null }).eq('id',body.id).eq('branch_id',branchId).select().maybeSingle();
      if(error)return json(500,{error:error.message}); if(!data)return json(404,{error:'Allocation not found.'}); return json(200,{allocation:data});
    }

    return json(405, { error: 'Method not allowed.' });
  }catch(e){
    console.error('allocations error', e);
    return json(500, { error: 'Unexpected error handling allocations.' });
  }
};
