/* Extracted from app.js; load order is intentional. */
/* ---------------- Event wiring ---------------- */

function wireTab(){
  // Daily
  const fd = document.getElementById('form-daily');
  if(fd) fd.addEventListener('submit', e => {
    e.preventDefault();
    const fdata = new FormData(fd);
    const date = fdata.get('date');
    const revenue_kes = Number(fdata.get('revenue_kes'));
    const notes = fdata.get('notes')||'';
    const errEl = document.getElementById('daily-err');
    if(state.closedMonths.includes(monthKey(date))){
      errEl.innerHTML = `<div class="err-msg">This date belongs to ${monthLabel(monthKey(date))}, which is already closed.</div>`; return;
    }
    const dupe = state.dailyRevenue.find(r=>r.date===date && r.id!==editingRevenueId);
    if(dupe){
      errEl.innerHTML = `<div class="err-msg">A revenue entry already exists for ${date}. Edit or delete it first ” duplicates aren't allowed.</div>`; return;
    }
    if(editingRevenueId){
      const rec = state.dailyRevenue.find(r=>r.id===editingRevenueId);
      if(rec){ rec.date=date; rec.revenue_kes=revenue_kes; rec.notes=notes; }
      editingRevenueId = null;
    } else {
      state.dailyRevenue.push({id:uid(), date, revenue_kes, notes});
    }
    queueSave(); render();
  });
  document.querySelectorAll('[data-edit-revenue]').forEach(b=>b.addEventListener('click',()=>{
    editingRevenueId = b.dataset.editRevenue; render();
  }));
  document.querySelectorAll('[data-del-revenue]').forEach(b=>b.addEventListener('click',()=>{
    if(editingRevenueId===b.dataset.delRevenue) editingRevenueId=null;
    state.dailyRevenue = state.dailyRevenue.filter(r=>r.id!==b.dataset.delRevenue); queueSave(); render();
  }));
  const cancelDaily = document.getElementById('cancel-edit-daily');
  if(cancelDaily) cancelDaily.addEventListener('click', ()=>{ editingRevenueId=null; render(); });

  // Expenses
  const fe = document.getElementById('form-expense');
  if(fe) fe.addEventListener('submit', e => {
    e.preventDefault();
    const fdata = new FormData(fe);
    const date = fdata.get('date');
    const txn_ref = (fdata.get('txn_ref')||'').trim();
    const errEl = document.getElementById('expense-err');
    if(state.closedMonths.includes(monthKey(date))){
      errEl.innerHTML = `<div class="err-msg">This date belongs to ${monthLabel(monthKey(date))}, which is already closed.</div>`; return;
    }
    if(!txn_ref){ errEl.innerHTML = `<div class="err-msg">Txn Ref is required.</div>`; return; }
    const dupe = state.expenses.find(x=>x.txn_ref.toLowerCase()===txn_ref.toLowerCase() && x.id!==editingExpenseId);
    if(dupe){
      errEl.innerHTML = `<div class="err-msg">Txn Ref "${txn_ref}" already exists ” duplicate rejected.</div>`; return;
    }
    const needsApprovalEl = fe.querySelector('[name=needs_approval]');
    const payload = {
      date, txn_ref, account_used:fdata.get('account_used'), category:fdata.get('category'),
      description:fdata.get('description')||'', paid_to:fdata.get('paid_to')||'',
      amount_kes:Number(fdata.get('amount_kes')), charges_kes:Number(fdata.get('charges_kes')||0),
      owner_funded: fe.querySelector('[name=owner_funded]').checked,
      status: needsApprovalEl && needsApprovalEl.checked ? 'pending_approval' : 'posted'
    };
    if(editingExpenseId){
      const rec = state.expenses.find(x=>x.id===editingExpenseId);
      if(rec) Object.assign(rec, payload);
      editingExpenseId = null;
    } else {
      state.expenses.push({id:uid(), ...payload});
    }
    queueSave(); render();
  });
  document.querySelectorAll('[data-edit-expense]').forEach(b=>b.addEventListener('click',()=>{
    editingExpenseId = b.dataset.editExpense; render();
  }));
  document.querySelectorAll('[data-del-expense]').forEach(b=>b.addEventListener('click',()=>{
    if(editingExpenseId===b.dataset.delExpense) editingExpenseId=null;
    state.expenses = state.expenses.filter(x=>x.id!==b.dataset.delExpense); queueSave(); render();
  }));
  document.querySelectorAll('[data-attach-expense]').forEach(b=>b.addEventListener('click',()=>{
    openAttachments('expense', b.dataset.attachExpense);
  }));
  wireAttachmentsPanel();
  const exportExpBtn = document.getElementById('btn-export-expenses-csv');
  if(exportExpBtn) exportExpBtn.addEventListener('click', exportExpensesCsv);
  const exportExpXlsxBtn = document.getElementById('btn-export-expenses-xlsx');
  if(exportExpXlsxBtn) exportExpXlsxBtn.addEventListener('click', exportExpensesXlsx);
  const exportRevBtn = document.getElementById('btn-export-revenue-csv');
  if(exportRevBtn) exportRevBtn.addEventListener('click', exportRevenueCsv);
  const assistantForm = document.getElementById('form-assistant');
  document.querySelectorAll('[data-cfo-quick]').forEach(b=>b.addEventListener('click',()=>askAssistant(b.dataset.cfoQuick)));
  document.querySelectorAll('[data-cfo-confirm]').forEach(b=>b.addEventListener('click',async()=>{try{const r=await apiFetch('/api/ai-action',{method:'POST',headers:JSONH,body:JSON.stringify({branch_id:state.branchId,action_id:b.dataset.cfoConfirm,confirm:true})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Action was not executed.');assistantMessages.push({role:'assistant',content:'Controlled action processed: '+JSON.stringify(d),classification:'CALCULATION'});render();}catch(e){assistantError=e.message;render();}}));
  document.querySelectorAll('[data-cfo-cancel]').forEach(b=>b.addEventListener('click',async()=>{try{await apiFetch('/api/ai-action',{method:'POST',headers:JSONH,body:JSON.stringify({branch_id:state.branchId,action_id:b.dataset.cfoCancel,confirm:false})});assistantMessages.push({role:'assistant',content:'The proposed action was cancelled and no ledger mutation was performed.',classification:'FACT'});render();}catch(e){assistantError=e.message;render();}}));
  if(assistantForm) assistantForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = new FormData(assistantForm).get('question');
    if(q && q.trim()) askAssistant(q.trim());
    assistantForm.reset();
  });
  const cancelExpense = document.getElementById('cancel-edit-expense');
  if(cancelExpense) cancelExpense.addEventListener('click', ()=>{ editingExpenseId=null; render(); });
  const addCat = document.getElementById('btn-add-category');
  if(addCat) addCat.addEventListener('click', ()=>{
    const name = (prompt('New expense category name:')||'').trim();
    if(!name) return;
    if(!state.categories) state.categories = DEFAULT_CATEGORIES.slice();
    if(!state.categories.some(c=>c.toLowerCase()===name.toLowerCase())) state.categories.push(name);
    queueSave(); render();
    setTimeout(()=>{ const sel = document.querySelector('[name=category]'); if(sel) sel.value = name; }, 0);
  });
  const fcat = document.getElementById('filter-category'); if(fcat) fcat.addEventListener('change', e=>{expenseFilters.category=e.target.value; render();});
  const facc = document.getElementById('filter-account'); if(facc) facc.addEventListener('change', e=>{expenseFilters.account=e.target.value; render();});
  const fown = document.getElementById('filter-owner'); if(fown) fown.addEventListener('change', e=>{expenseFilters.ownerFundedOnly=e.target.checked; render();});
  const fpending = document.getElementById('filter-pending'); if(fpending) fpending.addEventListener('change', e=>{expenseFilters.pendingOnly=e.target.checked; render();});
  document.querySelectorAll('[data-approve-expense]').forEach(b=>b.addEventListener('click',()=>approveExpense(b.dataset.approveExpense)));
  document.querySelectorAll('[data-reject-expense]').forEach(b=>b.addEventListener('click',()=>rejectExpense(b.dataset.rejectExpense)));
  const fileImport = document.getElementById('file-import');
  if(fileImport) fileImport.addEventListener('change', handleExpenseImport);

  // Loans
  const fl = document.getElementById('form-loan');
  if(fl) fl.addEventListener('submit', e=>{
    e.preventDefault(); const fdata = new FormData(fl);
    const payload = {
      debt_name:fdata.get('debt_name'), lender:fdata.get('lender')||'',
      original_principal_kes:Number(fdata.get('original_principal_kes')),
      current_balance_kes:Number(fdata.get('current_balance_kes')),
      annual_interest_rate_pct:Number(fdata.get('annual_interest_rate_pct')||0),
      start_date:fdata.get('start_date')||'', min_monthly_payment_kes:Number(fdata.get('min_monthly_payment_kes')||0),
      status:fdata.get('status')
    };
    if(editingLoanId){
      const rec = state.loans.find(l=>l.id===editingLoanId);
      if(rec) Object.assign(rec, payload);
      editingLoanId = null;
    } else {
      state.loans.push({id:uid(), ...payload});
    }
    queueSave(); render();
  });
  document.querySelectorAll('[data-edit-loan]').forEach(b=>b.addEventListener('click',()=>{
    editingLoanId = b.dataset.editLoan; render();
  }));
  document.querySelectorAll('[data-del-loan]').forEach(b=>b.addEventListener('click',()=>{
    if(editingLoanId===b.dataset.delLoan) editingLoanId=null;
    state.loans = state.loans.filter(l=>l.id!==b.dataset.delLoan); queueSave(); render();
  }));
  const cancelLoan = document.getElementById('cancel-edit-loan');
  if(cancelLoan) cancelLoan.addEventListener('click', ()=>{ editingLoanId=null; render(); });

  const fp = document.getElementById('form-payment');
  if(fp) fp.addEventListener('submit', e=>{
    e.preventDefault(); const fdata = new FormData(fp);
    const loan_id = fdata.get('loan_id'); if(!loan_id) return;
    const amount = Number(fdata.get('amount_kes'));
    const date = fdata.get('date');
    const note = fdata.get('note')||'';
    if(editingPaymentId){
      const rec = state.loanPayments.find(p=>p.id===editingPaymentId);
      if(rec){
        // reverse the old amount off the old loan's balance, then apply the new amount to the (possibly new) loan
        const oldLoan = state.loans.find(l=>l.id===rec.loan_id);
        if(oldLoan) oldLoan.current_balance_kes = Number(oldLoan.current_balance_kes) + Number(rec.amount_kes);
        rec.loan_id=loan_id; rec.date=date; rec.amount_kes=amount; rec.note=note;
        const newLoan = state.loans.find(l=>l.id===loan_id);
        if(newLoan){ newLoan.current_balance_kes = Math.max(0, Number(newLoan.current_balance_kes) - amount); newLoan.status = newLoan.current_balance_kes<=0 ? 'Paid Off' : 'Active'; }
      }
      editingPaymentId = null;
    } else {
      state.loanPayments.push({id:uid(), loan_id, date, amount_kes:amount, note});
      const loan = state.loans.find(l=>l.id===loan_id);
      if(loan){ loan.current_balance_kes = Math.max(0, Number(loan.current_balance_kes) - amount); if(loan.current_balance_kes<=0) loan.status='Paid Off'; }
    }
    queueSave(); render();
  });
  document.querySelectorAll('[data-edit-payment]').forEach(b=>b.addEventListener('click',()=>{
    editingPaymentId = b.dataset.editPayment; render();
  }));
  document.querySelectorAll('[data-del-payment]').forEach(b=>b.addEventListener('click',()=>{
    const p = state.loanPayments.find(x=>x.id===b.dataset.delPayment);
    if(p){
      const loan = state.loans.find(l=>l.id===p.loan_id);
      if(loan){ loan.current_balance_kes = Number(loan.current_balance_kes) + Number(p.amount_kes); loan.status='Active'; }
    }
    if(editingPaymentId===b.dataset.delPayment) editingPaymentId=null;
    state.loanPayments = state.loanPayments.filter(x=>x.id!==b.dataset.delPayment); queueSave(); render();
  }));
  const cancelPayment = document.getElementById('cancel-edit-payment');
  if(cancelPayment) cancelPayment.addEventListener('click', ()=>{ editingPaymentId=null; render(); });

  // Phase 18: complete reconciliation workbench
  let reconWorkbenchId = null;
  let reconWorkbenchData = null;
  async function reconAccountsLoad(){
    const sel=document.getElementById('recon-account'); if(!sel) return;
    try{ const r=await apiList('/api/financial-accounts',state.branchId); sel.innerHTML='<option value="">Select account¦</option>'+(r.accounts||[]).map(a=>`<option value="${a.id}">${a.name} Â· ${a.kind}</option>`).join(''); }
    catch(e){ sel.innerHTML='<option value="">Unable to load accounts</option>'; }
  }
  function parseCsvStatement(text){
    const lines=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());
    if(lines.length<2) return [];
    const parseLine=line=>{let out=[],cur='',quote=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quote&&line[i+1]==='"'){cur+='"';i++;}else quote=!quote;}else if(c===','&&!quote){out.push(cur.trim());cur='';}else cur+=c;}out.push(cur.trim());return out;};
    const headers=parseLine(lines[0]).map(h=>h.toLowerCase().replace(/[^a-z0-9]+/g,'_'));
    const pick=(obj,names)=>{for(const n of names){if(obj[n]!=null&&obj[n]!=='')return obj[n];}return '';};
    return lines.slice(1).map((line,idx)=>{const vals=parseLine(line),o={};headers.forEach((h,i)=>o[h]=vals[i]||'');
      const date=pick(o,['date','transaction_date','transactiondate','value_date','valuedate','posted_date']);
      let amountRaw=pick(o,['amount','transaction_amount','value','net_amount','debit','credit']);
      let direction=pick(o,['direction','type','transaction_type']).toLowerCase();
      const debit=pick(o,['debit','withdrawal','debit_amount']), credit=pick(o,['credit','deposit','credit_amount']);
      if(!direction && debit) direction='out'; if(!direction && credit) direction='in';
      if(!amountRaw && (debit||credit)) amountRaw=debit||credit;
      amountRaw=String(amountRaw).replace(/[^0-9.-]/g,'');
      if(debit && !credit) amountRaw=String(debit).replace(/[^0-9.-]/g,'');
      if(credit && !debit) amountRaw=String(credit).replace(/[^0-9.-]/g,'');
      if(direction==='debit'||direction==='withdrawal'||direction==='outflow')direction='out'; if(direction==='credit'||direction==='deposit'||direction==='inflow')direction='in';
      const reference=pick(o,['reference','transaction_reference','transaction_ref','receipt','receipt_number','trxid','transaction_id']);
      const description=pick(o,['description','details','narration','remarks','particulars']);
      const balance=pick(o,['balance','running_balance','closing_balance']);
      return {row_number:idx+2,date,amount:Math.abs(Number(amountRaw||0)),direction:direction==='out'?'out':'in',reference,description,balance};
    }).filter(r=>r.date&&r.amount>0);
  }
  async function reconLoad(id){
    if(!id) return;
    const r=await apiList('/api/reconciliation-center',state.branchId,{reconciliation_id:id});
    reconWorkbenchData=r; reconWorkbenchId=id;
    const s=r.summary||{}; const el=document.getElementById('recon-summary');
    if(el) el.innerHTML=`<div class="grid-3"><div class="stat"><div class="stat-label">Statement rows</div><div class="stat-value">${s.statementRows||0}</div></div><div class="stat"><div class="stat-label">Matched</div><div class="stat-value">${s.matched||0}</div></div><div class="stat"><div class="stat-label">Unmatched</div><div class="stat-value">${s.unmatched||0}</div></div></div><div class="hint" style="margin-top:8px">Status: <b>${r.reconciliation.status}</b> Â· Difference: <b>KES ${Number(r.reconciliation.difference||0).toLocaleString(undefined,{minimumFractionDigits:2})}</b> Â· Open exceptions: <b>${s.openExceptions||0}</b></div>`;
    const rowsEl=document.getElementById('recon-rows');
    if(rowsEl) rowsEl.innerHTML=`<table class="data-table"><thead><tr><th>Row</th><th>Date</th><th>Reference</th><th>Description</th><th>Amount</th><th>Dir</th><th>Status</th><th>Score</th><th>Action</th></tr></thead><tbody>${(r.rows||[]).map(row=>{const cand=(row.candidate_transaction_id||'');return `<tr><td>${row.source_row_number||''}</td><td>${row.external_date||''}</td><td>${row.external_reference||''}</td><td>${row.external_description||''}</td><td>KES ${Number(row.external_amount||0).toLocaleString()}</td><td>${row.external_direction}</td><td><b>${row.match_status}</b>${row.excluded_reason?`<div class="hint">${row.excluded_reason}</div>`:''}</td><td>${row.match_score?Math.round(Number(row.match_score)*100)+'%':'”'}</td><td>${row.match_status==='unmatched'&&cand?`<button class="btn ghost" data-recon-accept="${row.id}" data-recon-tx="${cand}">Accept</button>`:''}${['matched','manual'].includes(row.match_status)?`<button class="btn ghost" data-recon-unmatch="${row.id}">Unmatch</button>`:`<button class="btn ghost" data-recon-exclude="${row.id}">Exclude</button>`}</td></tr>`;}).join('')}</tbody></table>`;
    const exEl=document.getElementById('recon-exceptions'); if(exEl) exEl.innerHTML=`<h4>Exceptions</h4>${(r.exceptions||[]).map(x=>`<div class="form-card" style="padding:10px;margin:6px 0"><b>${x.severity.toUpperCase()}</b> Â· ${x.description}<span style="float:right">${x.status==='open'?`<button class="btn ghost" data-recon-resolve="${x.id}">Resolve</button>`:'Resolved'}</span></div>`).join('')||'<div class="hint">No exceptions.</div>'}`;
    const audEl=document.getElementById('recon-audit'); if(audEl) audEl.innerHTML=`<details><summary>Reconciliation audit trail</summary>${(r.audit||[]).map(a=>`<div class="hint" style="padding:5px 0;border-bottom:1px solid #eee"><b>${a.event_type}</b> Â· ${new Date(a.created_at).toLocaleString()}</div>`).join('')}</details>`;
    document.querySelectorAll('[data-recon-accept]').forEach(b=>b.onclick=async()=>{try{await apiCreate('/api/reconciliation-center',{branch_id:state.branchId,reconciliation_id:reconWorkbenchId,action:'match',external_row_id:b.dataset.reconAccept,financial_transaction_id:b.dataset.reconTx});await reconLoad(reconWorkbenchId);}catch(e){alert(e.message);}});
    document.querySelectorAll('[data-recon-unmatch]').forEach(b=>b.onclick=async()=>{try{await apiCreate('/api/reconciliation-center',{branch_id:state.branchId,reconciliation_id:reconWorkbenchId,action:'unmatch',external_row_id:b.dataset.reconUnmatch});await reconLoad(reconWorkbenchId);}catch(e){alert(e.message);}});
    document.querySelectorAll('[data-recon-exclude]').forEach(b=>b.onclick=async()=>{const reason=prompt('Reason for excluding this statement row:');if(!reason)return;try{await apiCreate('/api/reconciliation-center',{branch_id:state.branchId,reconciliation_id:reconWorkbenchId,action:'exclude',external_row_id:b.dataset.reconExclude,reason});await reconLoad(reconWorkbenchId);}catch(e){alert(e.message);}});
    document.querySelectorAll('[data-recon-resolve]').forEach(b=>b.onclick=async()=>{const resolution=prompt('Resolution / supporting explanation:');if(!resolution)return;try{await apiCreate('/api/reconciliation-center',{branch_id:state.branchId,reconciliation_id:reconWorkbenchId,action:'resolve_exception',exception_id:b.dataset.reconResolve,resolution});await reconLoad(reconWorkbenchId);}catch(e){alert(e.message);}});
  }
  reconAccountsLoad();
  const reconCreate=document.getElementById('btn-recon-create-full');
  if(reconCreate) reconCreate.onclick=async()=>{try{
    const account=document.getElementById('recon-account').value;if(!account)throw new Error('Select an account.');
    const file=document.getElementById('recon-file').files[0]; let rows=[]; if(file){rows=parseCsvStatement(await file.text());if(!rows.length)throw new Error('No valid statement rows were detected.');}
    const body={branch_id:state.branchId,account_id:account,period_start:document.getElementById('recon-period-start').value,period_end:document.getElementById('recon-period-end').value,opening_statement_balance:Number(document.getElementById('recon-opening').value||0),statement_balance:Number(document.getElementById('recon-closing').value||0),closing_statement_balance:Number(document.getElementById('recon-closing').value||0),tolerance_kes:Number(document.getElementById('recon-tolerance').value||.01),statement_source:document.getElementById('recon-source').value,statement_file_name:file?file.name:null,action:'create'};
    const created=await apiCreate('/api/reconciliation-center',body);reconWorkbenchId=created.reconciliation.id;if(rows.length)await apiCreate('/api/reconciliation-center',{branch_id:state.branchId,reconciliation_id:reconWorkbenchId,action:'import_rows',rows});document.getElementById('recon-workbench-status').textContent='Reconciliation opened. Generating match suggestions¦';await apiCreate('/api/reconciliation-center',{branch_id:state.branchId,reconciliation_id:reconWorkbenchId,action:'suggest_matches'});await reconLoad(reconWorkbenchId);document.getElementById('recon-workbench-status').textContent='Reconciliation ready for review.';
  }catch(e){document.getElementById('recon-workbench-status').textContent='Error: '+e.message;}};
  const reconRefresh=document.getElementById('btn-recon-refresh');if(reconRefresh)reconRefresh.onclick=()=>reconLoad(reconWorkbenchId);
  const reconSuggest=document.getElementById('btn-recon-suggest');if(reconSuggest)reconSuggest.onclick=async()=>{try{await apiCreate('/api/reconciliation-center',{branch_id:state.branchId,reconciliation_id:reconWorkbenchId,action:'suggest_matches'});await reconLoad(reconWorkbenchId);}catch(e){alert(e.message);}};
  const reconSubmit=document.getElementById('btn-recon-submit');if(reconSubmit)reconSubmit.onclick=async()=>{try{await apiCreate('/api/reconciliation-center',{branch_id:state.branchId,reconciliation_id:reconWorkbenchId,action:'submit'});await reconLoad(reconWorkbenchId);}catch(e){alert(e.message);}};
  const reconApprove=document.getElementById('btn-recon-approve');if(reconApprove)reconApprove.onclick=async()=>{try{await apiCreate('/api/reconciliation-center',{branch_id:state.branchId,reconciliation_id:reconWorkbenchId,action:'approve'});await reconLoad(reconWorkbenchId);}catch(e){alert(e.message);}};
  const reconReject=document.getElementById('btn-recon-reject');if(reconReject)reconReject.onclick=async()=>{const reason=prompt('Why are you rejecting this reconciliation?');if(!reason)return;try{await apiCreate('/api/reconciliation-center',{branch_id:state.branchId,reconciliation_id:reconWorkbenchId,action:'reject',reason});await reconLoad(reconWorkbenchId);}catch(e){alert(e.message);}};

  // Phase 21: professional Tax Intelligence
  let taxIntelData = null;
  async function loadTaxIntelligence(){
    try{
      const r=await apiList('/api/tax-intelligence',state.branchId);
      taxIntelData=r;
      const sum=r.summary||{};
      const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
      set('tax-outstanding',KES(sum.outstandingKes||0));
      set('tax-due30',KES(sum.due30Kes||0));
      set('tax-overdue',KES(sum.overdueKes||0));
      const p=r.profile||{};
      const vals={name:p.taxpayer_name||'',pin:p.kra_pin||'',yearend:p.accounting_year_end_month||12,tcc:p.tcc_status||'unknown',expiry:p.tcc_expiry_date||'',etims:p.etims_compliant===true?'true':p.etims_compliant===false?'':'',vat:p.vat_registered===true?'true':p.vat_registered===false?'':'',agent:p.tax_agent_name||'',agentContact:p.tax_agent_contact||''};
      [['taxp-name',vals.name],['taxp-pin',vals.pin],['taxp-yearend',vals.yearend],['taxp-tcc',vals.tcc],['taxp-tcc-expiry',vals.expiry],['taxp-etims',vals.etims],['taxp-vat',vals.vat],['taxp-agent',vals.agent],['taxp-agent-contact',vals.agentContact]].forEach(([id,v])=>{const e=document.getElementById(id);if(e)e.value=v;});
      const obs=r.obligations||[]; const periods=r.periods||[];
      const optObs=document.getElementById('tax-period-obligation'); if(optObs)optObs.innerHTML='<option value="">Select obligation¦</option>'+obs.filter(o=>o.applicable).map(o=>`<option value="${o.id}">${o.tax_type} Â· ${o.filing_authority||'Authority'}</option>`).join('');
      const optPeriods=document.getElementById('tax-action-period'); if(optPeriods)optPeriods.innerHTML='<option value="">Select tax period¦</option>'+periods.map(x=>`<option value="${x.id}">${x.tax_obligations?.tax_type||'Tax'} Â· ${x.period_start} â†’ ${x.period_end} Â· ${x.compliance?.label||''}</option>`).join('');
      const table=document.getElementById('tax-intelligence-table');
      if(table)table.innerHTML=`<table class="data-table"><thead><tr><th>Tax</th><th>Period</th><th>Filing Due</th><th>Payment Due</th><th>Due</th><th>Paid</th><th>Balance</th><th>Filing</th><th>Status</th></tr></thead><tbody>${periods.map(x=>{const bal=Math.max(0,Number(x.amount_due_kes||0)-Number(x.amount_paid_kes||0));const c=x.compliance||{};return `<tr><td>${x.tax_obligations?.tax_type||'”'}</td><td>${x.period_start} â†’ ${x.period_end}</td><td>${x.filing_due_date||'”'}</td><td>${x.payment_due_date||'”'}</td><td>${KES(x.amount_due_kes)}</td><td>${KES(x.amount_paid_kes)}</td><td>${KES(bal)}</td><td>${x.filing_status}</td><td><span class="tag ${c.severity==='critical'?'alert':c.severity==='warning'?'warn':c.severity==='good'?'good':''}">${c.label||'”'}</span>${c.days!==null&&c.days!==undefined?`<div class="hint">${c.days<0?Math.abs(c.days)+' days late':c.days+' days'}</div>`:''}</td></tr>`}).join('')||'<tr><td colspan="9" class="hint">No tax periods have been created yet.</td></tr>'}</tbody></table>`;
      const rules=document.getElementById('tax-rules-table');
      if(rules)rules.innerHTML=`<table class="data-table"><thead><tr><th>Tax</th><th>Frequency</th><th>Deadline</th><th>Filing</th><th>Authority</th><th>Verified</th></tr></thead><tbody>${(r.rules||[]).map(x=>`<tr><td>${x.tax_type}</td><td>${x.frequency}</td><td>${x.due_rule}</td><td>${x.filing_due_rule||'”'}</td><td>${x.authority}</td><td>${x.verified_at?new Date(x.verified_at).toLocaleDateString():'”'}</td></tr>`).join('')}</tbody></table>`;
      const reserve=Number(dashboardData().alloc?.tax||0), due30=Number(sum.due30Kes||0), out=Number(sum.outstandingKes||0);
      const ratio=out>0?reserve/out*100:100;
      const ra=document.getElementById('tax-reserve-analysis');
      if(ra)ra.innerHTML=`<b>Tax reserve:</b> ${KES(reserve)}<br><b>Outstanding known tax liabilities:</b> ${KES(out)}<br><b>Known liabilities due within 30 days:</b> ${KES(due30)}<br><b>Reserve coverage of outstanding known liabilities:</b> ${out>0?ratio.toFixed(1)+'%':'No known liability balance'}<br><span class="hint">This is a management indicator, not a tax assessment. Profit First reserves are compared with recorded tax liabilities only.</span>`;
      const ps=periods.find(x=>x.id===document.getElementById('tax-action-period')?.value); if(ps){};
    }catch(e){const el=document.getElementById('tax-intelligence-table');if(el)el.innerHTML=`<div class="err-msg">${e.message}</div>`;}
  }
  loadTaxIntelligence();
  const saveProfile=document.getElementById('btn-save-tax-profile'); if(saveProfile)saveProfile.onclick=async()=>{try{await apiCreate('/api/tax-intelligence',{branch_id:state.branchId,action:'profile',taxpayer_name:document.getElementById('taxp-name').value,kra_pin:document.getElementById('taxp-pin').value,accounting_year_end_month:Number(document.getElementById('taxp-yearend').value||12),tcc_status:document.getElementById('taxp-tcc').value,tcc_expiry_date:document.getElementById('taxp-tcc-expiry').value||null,etims_compliant:document.getElementById('taxp-etims').value===''?null:document.getElementById('taxp-etims').value==='true',vat_registered:document.getElementById('taxp-vat').value===''?null:document.getElementById('taxp-vat').value==='true',tax_agent_name:document.getElementById('taxp-agent').value||null,tax_agent_contact:document.getElementById('taxp-agent-contact').value||null});document.getElementById('tax-profile-status').textContent='Compliance profile saved.';await loadTaxIntelligence();}catch(e){document.getElementById('tax-profile-status').textContent='Error: '+e.message;}};
  const createPeriod=document.getElementById('btn-create-tax-period'); if(createPeriod)createPeriod.onclick=async()=>{try{const end=document.getElementById('tax-period-end').value;const start=document.getElementById('tax-period-start').value;if(!end||!start)throw new Error('Enter period dates.');await apiCreate('/api/tax-intelligence',{branch_id:state.branchId,action:'period',tax_obligation_id:document.getElementById('tax-period-obligation').value,period_start:start,period_end:end,amount_due_kes:Number(document.getElementById('tax-period-amount').value||0),filing_due_date:document.getElementById('tax-filing-due').value||null,payment_due_date:document.getElementById('tax-payment-due').value||null,filing_status:document.getElementById('tax-filing-status').value});document.getElementById('tax-period-status').textContent='Tax period saved and deadlines calculated where a rule is configured.';await loadTaxIntelligence();}catch(e){document.getElementById('tax-period-status').textContent='Error: '+e.message;}};
  const markFiled=document.getElementById('btn-mark-tax-filed'); if(markFiled)markFiled.onclick=async()=>{try{const id=document.getElementById('tax-action-period').value;if(!id)throw new Error('Select a tax period.');await apiCreate('/api/tax-intelligence',{branch_id:state.branchId,action:'file',tax_period_id:id,filing_status:'filed',filing_reference:document.getElementById('tax-filing-reference').value||null});document.getElementById('tax-action-status').textContent='Filing status recorded.';await loadTaxIntelligence();}catch(e){document.getElementById('tax-action-status').textContent='Error: '+e.message;}};
  const payTax=document.getElementById('btn-record-tax-payment'); if(payTax)payTax.onclick=async()=>{try{const id=document.getElementById('tax-action-period').value;if(!id)throw new Error('Select a tax period.');const amount=Number(document.getElementById('tax-payment-amount').value||0);if(amount<=0)throw new Error('Enter a positive payment amount.');await apiCreate('/api/tax-intelligence',{branch_id:state.branchId,action:'payment',tax_period_id:id,payment_date:document.getElementById('tax-payment-date').value,amount_kes:amount,reference:document.getElementById('tax-payment-reference').value||null});document.getElementById('tax-action-status').textContent='Tax payment recorded and the period balance updated.';await loadTaxIntelligence();}catch(e){document.getElementById('tax-action-status').textContent='Error: '+e.message;}};
  const evidence=document.getElementById('btn-add-tax-evidence'); if(evidence)evidence.onclick=async()=>{try{const id=document.getElementById('tax-action-period').value;if(!id)throw new Error('Select a tax period.');await apiCreate('/api/tax-intelligence',{branch_id:state.branchId,action:'evidence',tax_period_id:id,evidence_type:document.getElementById('tax-evidence-type').value,reference:document.getElementById('tax-evidence-reference').value||null,storage_path:document.getElementById('tax-evidence-path').value||null});document.getElementById('tax-action-status').textContent='Evidence record attached.';}catch(e){document.getElementById('tax-action-status').textContent='Error: '+e.message;}};

  // Tax
  document.querySelectorAll('[data-tax-applicable]').forEach(cb=>cb.addEventListener('change',()=>{
    const t = state.taxObligations.find(x=>x.id===cb.dataset.taxApplicable); t.applicable = cb.checked; queueSave(); render();
  }));
  document.querySelectorAll('[data-tax-frequency]').forEach(el=>el.addEventListener('change',()=>{
    const t = state.taxObligations.find(x=>x.id===el.dataset.taxFrequency); t.frequency = el.value; queueSave(); render();
  }));
  document.querySelectorAll('[data-tax-dueday]').forEach(el=>el.addEventListener('change',()=>{
    const t = state.taxObligations.find(x=>x.id===el.dataset.taxDueday); t.due_day_of_month = Number(el.value); queueSave();
  }));
  document.querySelectorAll('[data-tax-manualdue]').forEach(el=>el.addEventListener('change',()=>{
    const t = state.taxObligations.find(x=>x.id===el.dataset.taxManualdue); t.manual_next_due_date = el.value; queueSave(); render();
  }));
  document.querySelectorAll('[data-tax-amount]').forEach(el=>el.addEventListener('change',()=>{
    const t = state.taxObligations.find(x=>x.id===el.dataset.taxAmount); t.estimated_amount_kes = Number(el.value); queueSave(); render();
  }));
  document.querySelectorAll('[data-tax-authority]').forEach(el=>el.addEventListener('change',()=>{
    const t = state.taxObligations.find(x=>x.id===el.dataset.taxAuthority); t.filing_authority = el.value; queueSave();
  }));
  document.querySelectorAll('[data-del-tax]').forEach(b=>b.addEventListener('click',()=>{
    state.taxObligations = state.taxObligations.filter(t=>t.id!==b.dataset.delTax); queueSave(); render();
  }));
  const addTax = document.getElementById('btn-add-tax');
  if(addTax) addTax.addEventListener('click', ()=>{
    const name = prompt('Custom tax type name:'); if(!name) return;
    state.taxObligations.push({id:uid(), tax_type:name, applicable:true, frequency:'Monthly', due_day_of_month:20, manual_next_due_date:'', estimated_amount_kes:0, filing_authority:'KRA', notes:''});
    queueSave(); render();
  });

  // Dashboard close-month
  const btnClose = document.getElementById('btn-close-month');
  if(btnClose) btnClose.addEventListener('click', ()=>{ confirmCloseMonth = true; render(); });
  const btnCancel = document.getElementById('btn-cancel-close');
  if(btnCancel) btnCancel.addEventListener('click', ()=>{ confirmCloseMonth = false; render(); });
  const btnConfirm = document.getElementById('btn-confirm-close');
  if(btnConfirm) btnConfirm.addEventListener('click', doCloseMonth);
  const btnPrint = document.getElementById('btn-print-report');
  if(btnPrint) btnPrint.addEventListener('click', ()=> window.print());

  // Settings
  const fs = document.getElementById('form-settings');
  if(fs) fs.addEventListener('submit', e=>{
    e.preventDefault(); const fdata = new FormData(fs);
    const p = Number(fdata.get('pct_profit')), o=Number(fdata.get('pct_owner_debt')), t=Number(fdata.get('pct_tax')), x=Number(fdata.get('pct_opex'));
    const errEl = document.getElementById('settings-err');
    if(Math.round((p+o+t+x)*100)/100 !== 100){ errEl.innerHTML = `<div class="err-msg">Percentages must sum to exactly 100% (currently ${p+o+t+x}%).</div>`; return; }
    state.settings.pct_profit=p; state.settings.pct_owner_debt=o; state.settings.pct_tax=t; state.settings.pct_opex=x;
    state.settings.debt_paydown_split_pct = Number(fdata.get('debt_paydown_split_pct'));
    state.settings.monthly_revenue_target_kes = Number(fdata.get('monthly_revenue_target_kes'));
    state.settings.opening_opex_account_balance_kes = Number(fdata.get('opening_opex_account_balance_kes'));
    queueSave(); render();
  });
  document.querySelectorAll('[data-del-category]').forEach(b=>b.addEventListener('click',()=>{
    const name = b.dataset.delCategory;
    if(state.expenses.some(e=>e.category===name)){
      alert(`Can't remove "${name}" ” it's used by existing expenses. Recategorize those first.`);
      return;
    }
    state.categories = CATS().filter(c=>c!==name);
    queueSave(); render();
  }));
  const addCatSettings = document.getElementById('btn-add-category-settings');
  if(addCatSettings) addCatSettings.addEventListener('click', ()=>{
    const name = (prompt('New expense category name:')||'').trim();
    if(!name) return;
    if(!state.categories) state.categories = DEFAULT_CATEGORIES.slice();
    if(!state.categories.some(c=>c.toLowerCase()===name.toLowerCase())) state.categories.push(name);
    queueSave(); render();
  });
  const btnExport = document.getElementById('btn-export');
  if(btnExport) btnExport.addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'happynet-export.json'; a.click();
    URL.revokeObjectURL(url);
  });
}

/* ---------------- Auth / Boot ---------------- */

function authText(value){
  return String(value || '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
}

function renderLogin(errMsg, mode='login', noticeMsg=''){
  const isSignup = mode === 'signup';
  const title = isSignup ? 'Create your account' : 'Welcome Back';
  const subtitle = isSignup ? 'Start managing your financial performance today' : 'Sign in to access your financial dashboard';
  const errorMarkup = errMsg ? `<div class="err-msg login-status-error" role="alert">${authText(errMsg)}</div>` : '';
  const noticeMarkup = noticeMsg ? `<div class="login-status-notice" role="status">${authText(noticeMsg)}</div>` : '';
  root().innerHTML = `
    <div class="login-wrap">
      <div class="login-hero">
        <div class="login-hero-rings"></div>
        <div>
          <div class="login-logo">
            <span class="login-logo-mark">ðŸ¤™</span>
            <span class="login-logo-word">happy<b>net</b></span>
          </div>
          <div class="login-logo-sub"><i></i><span>TECHNOLOGIES</span><i></i></div>
        </div>

        <div class="login-hero-mid">
          <h1 class="login-headline">Smart Finances<br>Stronger Business<i></i></h1>
          <p class="login-hero-sub">Track performance, manage finances and make data-driven decisions.</p>

          <div class="login-features">
            <div class="login-feature">
              <div class="login-feature-icon">${ICON_BAR_CHART}</div>
              <span>Financial<br>Insights</span>
            </div>
            <div class="login-feature">
              <div class="login-feature-icon">${ICON_PIE_CHART}</div>
              <span>Real-time<br>Reports</span>
            </div>
            <div class="login-feature">
              <div class="login-feature-icon">${ICON_TRENDING_UP}</div>
              <span>Performance<br>Tracking</span>
            </div>
            <div class="login-feature">
              <div class="login-feature-icon">${ICON_SHIELD}</div>
              <span>Secure<br>Access</span>
            </div>
          </div>

          <div class="login-hero-chart">${LOGIN_CHART_SVG}</div>
        </div>

        <div class="login-security">
          <div class="login-security-icon">${ICON_SHIELD_SM}</div>
          <span>Your data is protected with enterprise grade security.</span>
        </div>
      </div>

      <div class="login-panel">
        <div class="login-card">
          <div class="login-card-icon">${ICON_SIGNAL}</div>
          <p class="login-title">${title}</p>
          <p class="login-sub">${subtitle}</p>
          <form id="form-login" ${isSignup ? 'class="is-signup"' : ''}>
            <label>Email Address</label>
            <div class="login-input-wrap">${ICON_MAIL}<input type="email" name="email" placeholder="Enter your email" required autocomplete="email"></div>
            <label>Password</label>
            <div class="login-input-wrap">
              ${ICON_LOCK}
              <input type="password" name="password" id="login-password" placeholder="Enter your password" minlength="8" required autocomplete="${isSignup ? 'new-password' : 'current-password'}">
              <button type="button" class="toggle-pw" id="toggle-pw" aria-label="Show password">${ICON_EYE}</button>
            </div>
            ${isSignup ? `<label>Confirm Password</label>
            <div class="login-input-wrap">${ICON_LOCK}<input type="password" name="confirm_password" id="confirm-password" placeholder="Re-enter your password" minlength="8" required autocomplete="new-password"><button type="button" class="toggle-pw" id="toggle-confirm-pw" aria-label="Show password">${ICON_EYE}</button></div>` : ''}
            ${isSignup ? `<p class="login-password-hint">Use at least 8 characters.</p>` : `<div class="login-row-between"><label class="check-row"><input type="checkbox" name="remember" checked> Remember me</label><a id="forgot-password" href="#forgot-password">Forgot Password?</a></div>`}
            <button class="btn full" style="background:var(--ink); color:#fff;" type="submit">${isSignup ? 'Create account' : `${ICON_LOCK_SM_WHITE}Sign In`}</button>
            ${errorMarkup}${noticeMarkup}
          </form>
          ${isSignup ? '' : `<div id="forgot-panel" class="login-forgot-panel" hidden>
            <form id="form-reset"><label for="reset-email">Reset your password</label><div class="login-input-wrap">${ICON_MAIL}<input type="email" id="reset-email" name="email" placeholder="Enter your account email" required autocomplete="email"></div><button class="btn full" type="submit">Send reset email</button><div id="reset-status" role="status"></div></form>
          </div><div class="login-divider"><i></i>or<i></i></div><button type="button" class="btn google" id="google-signin">${ICON_GOOGLE}Sign in with Google</button>`}
          <p class="login-foot">${isSignup ? 'Already have an account?' : "Don't have an account?"} <a id="switch-auth" href="#">${isSignup ? 'Sign in' : 'Create one'}</a></p>
        </div>
      </div>
    </div>`;
  const authForm = document.getElementById('form-login');
  authForm.addEventListener('submit', async e=>{
    e.preventDefault();
    const fd = new FormData(e.target);
    const submitBtn = e.target.querySelector('button[type=submit]');
    if(isSignup && fd.get('password') !== fd.get('confirm_password')){
      renderLogin('Passwords do not match.', 'signup');
      return;
    }
    submitBtn.disabled = true; submitBtn.textContent = isSignup ? 'Creating account...' : 'Signing in...';
    try{
      if(isSignup){
        const result = await apiSignup(fd.get('email'), fd.get('password'));
        if(result.access_token) await startApp();
        else renderLogin(null, 'login', 'Account created. Check your email to confirm your address, then sign in.');
      } else {
        await apiLogin(fd.get('email'), fd.get('password'), fd.get('remember') === 'on');
        await startApp();
      }
    }catch(err){
      renderLogin(err.message, mode);
    }
  });
  const wirePasswordToggle = (buttonId, inputId) => document.getElementById(buttonId)?.addEventListener('click', e => {
    const input = document.getElementById(inputId);
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    e.currentTarget.innerHTML = showing ? ICON_EYE : ICON_EYE_OFF;
    e.currentTarget.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  });
  wirePasswordToggle('toggle-pw', 'login-password');
  wirePasswordToggle('toggle-confirm-pw', 'confirm-password');
  document.getElementById('switch-auth').addEventListener('click', e=>{ e.preventDefault(); renderLogin(null, isSignup ? 'login' : 'signup'); });
  document.getElementById('forgot-password')?.addEventListener('click', e=>{ e.preventDefault(); const panel = document.getElementById('forgot-panel'); panel.hidden = !panel.hidden; if(!panel.hidden) document.getElementById('reset-email').focus(); });
  document.getElementById('form-reset')?.addEventListener('submit', async e=>{
    e.preventDefault();
    const button = e.target.querySelector('button[type=submit]');
    const status = document.getElementById('reset-status');
    button.disabled = true; button.textContent = 'Sending...'; status.className = '';
    try{ await apiResetPassword(new FormData(e.target).get('email')); status.textContent = 'If an account exists for that email, a reset link is on its way.'; e.target.reset(); }
    catch(err){ status.className = 'login-status-error'; status.textContent = err.message; }
    finally{ button.disabled = false; button.textContent = 'Send reset email'; }
  });
  document.getElementById('google-signin')?.addEventListener('click', signInWithGoogle);
}

async function startApp(){
  const s = getSession();
  if(!s){ renderLogin(); return; }
  currentUserEmail = s.user ? s.user.email : '';
  root().innerHTML = `<div class="loading-screen">Loading Happynet¦</div>`;
  try{
    await loadState();
  }catch(e){
    renderLogin(e.message || 'Your session expired ” please sign in again.');
    return;
  }
  render();
}

(async function boot(){
  const s = getSession();
  if(!s){
    const oauthHandled = await handleOAuthCallback();
    if(oauthHandled){ await startApp(); return; }
    renderLogin();
    return;
  }
  await startApp();
})();