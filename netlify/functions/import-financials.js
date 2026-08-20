const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');

const asMoney = v => {
  const n = Number(String(v ?? '').replace(/,/g,'').trim());
  return Number.isFinite(n) ? Math.abs(n) : 0;
};
const isoDate = v => {
  const s=String(v||'').trim();
  if(!s) return null;
  const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d=s.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if(d) return `${d[3]}-${d[2]}-${d[1]}`;
  return s.slice(0,10);
};
async function getAccount(admin, branchId, name, kind='other'){
  const {data}=await admin.from('financial_accounts').select('id').eq('branch_id',branchId).eq('name',name).maybeSingle();
  if(data) return data.id;
  const {data:created,error}=await admin.from('financial_accounts')
    .insert({branch_id:branchId,name,kind}).select('id').maybeSingle();
  if(error) throw new Error(error.message);
  return created.id;
}
async function getCategory(admin, branchId, name, kind){
  const {data}=await admin.from('categories').select('id').eq('branch_id',branchId).eq('name',name).eq('kind',kind).maybeSingle();
  if(data) return data.id;
  const {data:created,error}=await admin.from('categories').insert({branch_id:branchId,name,kind}).select('id').maybeSingle();
  if(error) throw new Error(error.message);
  return created.id;
}
async function getJohnLoan(admin, branchId, date, userId){
  let {data:loan,error}=await admin.from('loans').select('*').eq('branch_id',branchId).eq('is_deleted',false)
    .ilike('debt_name','%John%').maybeSingle();
  if(error) throw new Error(error.message);
  if(!loan){
    const created=await admin.from('loans').insert({
      branch_id:branchId,debt_name:'John — Owner Loan',lender:'John',
      original_principal_kes:0,current_balance_kes:0,start_date:date,status:'ACTIVE'
    }).select().maybeSingle();
    if(created.error) throw new Error(created.error.message);
    loan=created.data;
  }
  return loan;
}

exports.handler = async event => {
  const method = event.httpMethod;

  // 1. Handle CORS Preflight Requests
  if (method === 'OPTIONS') {
    return json(200, { ok: true });
  }

  // 2. Environment Variables Verification Check
  if (!process.env.SUPABASE_URL || (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_ANON_KEY)) {
    return json(500, {
      status: 'not configured',
      error: 'Missing required Supabase environment variables on server.'
    });
  }

  // 3. System Health Probe / Ping Diagnostic
  const isHealthCheck = event.queryStringParameters && (event.queryStringParameters.health === 'true' || event.queryStringParameters.probe === '1');
  if (isHealthCheck || method === 'GET') {
    return json(200, {
      status: 'configured',
      module: 'import-financials.js',
      reachable: true
    });
  }

  if (method !== 'POST') return json(405, { error: 'POST only' });

  let admin;
  try {
    admin = adminClient();
  } catch (err) {
    return json(500, { status: 'not configured', error: err.message });
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch(e) { return json(400, { error: 'Invalid JSON' }); }
  const branchId = body.branch_id;

  const ctx = await requireBranchAccess(event, requireUser, admin, branchId, { write: true });
  if (ctx.error) return json(ctx.status, { error: ctx.error });

  const source = body.source_system;
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!['tende','organization_utility'].includes(source) || !rows.length)
    return json(400, { error: 'source_system and rows are required' });

  const batch = await admin.from('financial_import_batches').insert({
    branch_id: branchId, source_system: source, file_name: body.file_name || null,
    imported_by: ctx.user.id, rows_received: rows.length, status: 'processing'
  }).select().maybeSingle();
  if (batch.error) return json(500, { error: batch.error.message });
  const batchId = batch.data.id;

  const result = { created: [], skipped: [], review: [], errors: [] };
  for (const r of rows) {
    try {
      const ref = String(r.source_ref || r.ref || r.receipt_no || r.REF || '').trim();
      if (!ref) { result.review.push({ reason: 'Missing source reference', row: r }); continue; }
      const { data: existing } = await admin.from('financial_transactions').select('id,transaction_type')
        .eq('branch_id', branchId).eq('source_system', source).eq('source_ref', ref).maybeSingle();
      if (existing) { result.skipped.push({ ref, reason: 'Already imported' }); continue; }

      let tx = null;
      if (source === 'organization_utility') {
        const status = String(r.transaction_status || r['Transaction Status'] || '').toLowerCase();
        const details = String(r.details || r.Details || '');
        const withdrawn = asMoney(r.withdrawn || r.Withdrawn);
        const isSettlement = /organization settlement account/i.test(details) && status === 'completed' && withdrawn > 0;
        if (!isSettlement) { result.review.push({ ref, reason: 'Utility row not an organization settlement; not posted as revenue', row: r }); continue; }
        const date = isoDate(r.completion_time || r['Completion Time']);
        const accountId = await getAccount(admin, branchId, 'Organization Utility Account', 'other');
        const categoryId = await getCategory(admin, branchId, 'Internet Service Revenue', 'revenue');
        const rev = await admin.from('revenue_entries').insert({
          branch_id: branchId, entry_date: date, account_id: accountId, category_id: categoryId,
          amount_kes: withdrawn, notes: `Organization utility settlement ${ref}`,
          source: 'organization_utility', created_by: ctx.user.id
        }).select().maybeSingle();
        if (rev.error) throw new Error(rev.error.message);
        tx = {
          branch_id: branchId, transaction_date: date, transaction_type: 'revenue', direction: 'in',
          gross_amount_kes: withdrawn, charges_kes: 0, net_amount_kes: withdrawn, account_id: accountId,
          category_id: categoryId, revenue_entry_id: rev.data.id, import_batch_id: batchId,
          source_system: source, source_ref: ref, external_ref: r.linked_transaction_id || null,
          counterparty: r.other_party_info || null, description: details, source_status: status,
          raw_data: r, created_by: ctx.user.id
        };
      } else {
        const status = String(r.status || r.STATUS || '').toUpperCase();
        if (status !== 'SUCCESS') { result.review.push({ ref, reason: 'Tende transaction not SUCCESS', row: r }); continue; }
        const service = String(r.service || r.SERVICE || '').toUpperCase();
        const amount = asMoney(r.amount || r.AMOUNT);
        const charge = asMoney(r.charge || r.CHARGE);
        const date = isoDate(r.date_initiated || r['DATE INITIATED']);
        const remark = String(r.remark || r.REMARK || '');
        const name = String(r.name || r.NAME || '');
        const counterparty = String(r.receiver || r.RECEIVER || r.name || r.NAME || '');
        const isIncoming = service === 'INCOMING';
        const lenderIsJohn = /\bJOHN\b/i.test(`${remark} ${name} ${r.status_message || r['STATUS MESSAGE'] || ''}`);
        
        if (isIncoming) {
          const loan = await getJohnLoan(admin, branchId, date, ctx.user.id);
          const newBalance = Number(loan.current_balance_kes || 0) + amount;
          const newOriginal = Number(loan.original_principal_kes || 0) + amount;
          const upd = await admin.from('loans').update({ current_balance_kes: newBalance, original_principal_kes: newOriginal, updated_at: new Date().toISOString() }).eq('id', loan.id);
          if (upd.error) throw new Error(upd.error.message);
          tx = {
            branch_id: branchId, transaction_date: date, transaction_type: 'owner_loan_funding', direction: 'in',
            gross_amount_kes: amount, charges_kes: 0, net_amount_kes: amount, loan_id: loan.id, import_batch_id: batchId,
            source_system: source, source_ref: ref, external_ref: r.ref_no || r['REF NO'] || null, counterparty: lenderIsJohn ? 'John' : (name || 'John'),
            description: remark || `Owner loan funding${lenderIsJohn ? ' from John' : ''}`, source_status: status, raw_data: r, created_by: ctx.user.id
          };
        } else if (!isIncoming) {
          const accountId = await getAccount(admin, branchId, 'Tende Operating Account', 'other');
          const categoryName = remark || 'Tende Expense';
          const categoryId = await getCategory(admin, branchId, categoryName, 'expense');
          const exp = await admin.from('expenses').insert({
            branch_id: branchId, expense_date: date, txn_ref: ref, account_id: accountId, category_id: categoryId,
            description: remark || service, paid_to: counterparty, amount_kes: amount, charges_kes: charge,
            owner_funded: false, status: 'posted', source: 'tende', created_by: ctx.user.id
          }).select().maybeSingle();
          if (exp.error) {
            if (exp.error.code === '23505') { result.skipped.push({ ref, reason: 'Expense transaction already exists' }); continue; }
            throw new Error(exp.error.message);
          }
          tx = {
            branch_id: branchId, transaction_date: date, transaction_type: 'expense', direction: 'out',
            gross_amount_kes: amount, charges_kes: charge, net_amount_kes: amount + charge, account_id: accountId,
            category_id: categoryId, expense_id: exp.data.id, import_batch_id: batchId,
            source_system: source, source_ref: ref, external_ref: r.ref_no || r['REF NO'] || null, counterparty,
            description: remark || service, source_status: status, raw_data: r, created_by: ctx.user.id
          };
        } else {
          result.review.push({ ref, reason: 'Tende transaction could not be classified', row: r });
          continue;
        }
      }
      const ins = await admin.from('financial_transactions').insert(tx).select().maybeSingle();
      if (ins.error) {
        if (ins.error.code === '23505') { result.skipped.push({ ref, reason: 'Already imported' }); continue; }
        throw new Error(ins.error.message);
      }
      
      const cashMovement = {
        branch_id: branchId,
        movement_date: tx.transaction_date,
        movement_type: tx.transaction_type,
        direction: tx.direction,
        amount_kes: tx.net_amount_kes,
        from_account_id: tx.direction === 'outflow' ? tx.account_id : null,
        to_account_id: tx.direction === 'inflow' ? tx.account_id : null,
        financial_transaction_id: ins.data.id,
        source_ref: ref,
        description: tx.description || null,
        reason: 'Imported from official source file',
        created_by: ctx.user.id
      };
      const cm = await admin.from('cash_movements').insert(cashMovement);
      if (cm.error && cm.error.code !== '23505') throw new Error(cm.error.message);
      result.created.push({ ref, type: tx.transaction_type, amount: tx.net_amount_kes, date: tx.transaction_date });
    } catch(e) {
      result.errors.push({ ref: r.source_ref || r.ref || r.receipt_no || '', error: e.message });
    }
  }
  await admin.from('financial_import_batches').update({
    rows_created: result.created.length, rows_skipped: result.skipped.length,
    rows_review: result.review.length, status: result.errors.length ? 'completed_with_errors' : 'completed'
  }).eq('id', batchId);
  return json(200, { batch_id: batchId, ...result });
};