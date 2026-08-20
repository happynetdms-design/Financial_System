/* Extracted from app.js; load order is intentional. */
/* ---------------- DASHBOARD ---------------- */

function viewDashboard(){
  const d = dashboardData();
  const closed = state.closedMonths.includes(d.ym);
  return `
    <div class="topbar">
      <div><h1>Monthly Dashboard</h1><div class="sub">Live view of ${monthLabel(d.ym)} â€” nothing here is manually edited.</div></div>
      <div class="topbar-actions">
        <div class="month-pill ${closed?'closed':''}"><span class="dot">${ic('calendar',13)}</span>Day ${d.daysElapsed} of ${d.dim}</div>
        <button class="btn ghost sm no-print" id="btn-print-report">${ic('printer',14)}Print Monthly Report</button>
      </div>
    </div>

    <div class="grid kpi">
      <div class="card kpi">
        <div class="kpi-head"><h3>Revenue Pace</h3><div class="kpi-icon tone-gold">${ic('trendUp',16)}</div></div>
        <div class="big">${d.revenuePacePct.toFixed(0)}%</div>
        <div class="signal lit-${signalLevel(d.revenuePacePct)}"><i></i><i></i><i></i><i></i></div>
        <div class="foot" style="margin-top:8px;">${KES(d.totalRevenue)} booked toward a ${KES(d.target)} target</div>
      </div>
      <div class="card kpi">
        <div class="kpi-head"><h3>Operating Expense Pace</h3><div class="kpi-icon tone-navy">${ic('wallet',16)}</div></div>
        <div class="big">${d.opexPacePct.toFixed(0)}%</div>
        <div class="signal lit-${signalLevel(200-d.opexPacePct)}"><i></i><i></i><i></i><i></i></div>
        <div class="foot" style="margin-top:8px;">${d.overspent ? `<span class="tag alert">Overspent ${KES(Math.abs(d.opexVariance))}</span>` : `<span class="tag good">${KES(d.opexVariance)} left</span>`} of ${KES(d.alloc.opex)} budget</div>
      </div>
      <div class="card kpi">
        <div class="kpi-head"><h3>Projected Month-End Revenue</h3><div class="kpi-icon tone-good">${ic('target',16)}</div></div>
        <div class="big">${KES(d.projRevenue)}</div>
        <div class="foot">${d.projRevenue>=d.target?'On track to clear target':'Tracking below target'}</div>
      </div>
      <div class="card kpi">
        <div class="kpi-head"><h3>Projected Month-End OpEx</h3><div class="kpi-icon tone-navy">${ic('pieChart',16)}</div></div>
        <div class="big">${KES(d.projOpex)}</div>
        <div class="foot">vs ${KES(d.alloc.opex)} budgeted so far this month</div>
      </div>
    </div>

    <div class="section-head"><h2>Business health, in plain English</h2></div>
    <div class="narrative"><div class="narrative-icon">${ic('message',15)}</div>${narrativeText(d)}</div>

    <div class="section-head"><h2>Where today's shilling goes</h2>
      <div class="toolbar"><span class="hint">Default split â€” edit in Settings</span></div>
    </div>
    <div class="pf-bucket-row">
      <div class="pf-bucket" style="--tone:var(--gold-deep);"><div class="pf-bucket-icon">${ic('piggyBank',16)}</div><div class="label">Profit (${state.settings.pct_profit}%)</div><div class="amt">${KES(d.alloc.profit)}</div></div>
      <div class="pf-bucket" style="--tone:#6C63B5;"><div class="pf-bucket-icon">${ic('handshake',16)}</div><div class="label">Owner Pay &amp; Debt (${state.settings.pct_owner_debt}%)</div><div class="amt">${KES(d.alloc.owner_debt)}</div></div>
      <div class="pf-bucket" style="--tone:var(--alert);"><div class="pf-bucket-icon">${ic('landmark',16)}</div><div class="label">Tax Reserve (${state.settings.pct_tax}%)</div><div class="amt">${KES(d.alloc.tax)}</div></div>
      <div class="pf-bucket" style="--tone:var(--ink-soft);"><div class="pf-bucket-icon">${ic('briefcase',16)}</div><div class="label">OpEx Budget (${state.settings.pct_opex}%)</div><div class="amt">${KES(d.alloc.opex)}</div></div>
    </div>

    <div class="section-head"><h2>Close ${monthLabel(d.ym)}</h2></div>
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:14px; flex-wrap:wrap;">
        <div class="sub" style="color:var(--muted); font-size:13.5px;">Archives this month's totals into the Trend Archive and opens a fresh month. Past data is kept forever, never deleted.</div>
        ${canWrite() ? `<button class="btn gold" id="btn-close-month" ${closed?'disabled':''}>${closed?'Month already closed':'Close Month'}</button>` : `<span class="hint" style="display:flex; align-items:center; gap:8px;">${ic('lock',14)}Read-only access</span>`}
      </div>
    </div>
    ${renderCloseMonthModal(d)}
  `;
}

function renderCloseMonthModal(d){
  if(!confirmCloseMonth) return '';
  return `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <h3>Close ${monthLabel(d.ym)}?</h3>
        <div class="sub" style="color:var(--muted); font-size:13.5px;">This snapshots the totals below into the Trend Archive. ${monthLabel(d.ym)} will then be locked â€” new entries for this month will be blocked.</div>
        <div class="totals">
          <div><span>Total Revenue</span><b class="num">${KES(d.totalRevenue)}</b></div>
          <div><span>Profit Reserved</span><b class="num">${KES(d.alloc.profit)}</b></div>
          <div><span>Owner Pay &amp; Debt</span><b class="num">${KES(d.alloc.owner_debt)}</b></div>
          <div><span>Tax Reserve</span><b class="num">${KES(d.alloc.tax)}</b></div>
          <div><span>OpEx Budget</span><b class="num">${KES(d.alloc.opex)}</b></div>
          <div><span>Actual OpEx (net)</span><b class="num">${KES(d.netOpex)}</b></div>
        </div>
        <div class="modal-actions">
          <button class="btn ghost" id="btn-cancel-close">Cancel</button>
          <button class="btn gold" id="btn-confirm-close">Confirm &amp; Archive</button>
        </div>
      </div>
    </div>
  `;
}

function doCloseMonth(){
  const d = dashboardData();
  state.monthlyArchive.push({
    id: uid(), month: d.ym, month_label: monthLabel(d.ym),
    total_revenue_kes: d.totalRevenue,
    daily_avg_revenue_kes: d.daysElapsed? d.totalRevenue/d.daysElapsed : 0,
    profit_reserved_kes: d.alloc.profit,
    owner_pay_allocated_kes: d.alloc.owner_debt,
    tax_reserve_kes: d.alloc.tax,
    opex_budget_kes: d.alloc.opex,
    actual_opex_kes: d.netOpex,
    opex_running_balance_kes: d.alloc.opex - d.netOpex,
    net_cash_to_ops_kes: d.totalRevenue - d.netOpex - d.alloc.profit - d.alloc.owner_debt - d.alloc.tax + (d.alloc.opex-d.netOpex),
    opex_ratio_pct: d.totalRevenue? (d.netOpex/d.totalRevenue)*100 : 0,
    revenue_achievement_pct: d.target? (d.totalRevenue/d.target)*100 : 0
  });
  state.closedMonths.push(d.ym);
  confirmCloseMonth = false;
  queueSave();
  render();
}

/* ---------------- DAILY ENTRY ---------------- */

function viewDaily(){
  const ym = currentOpenMonth();
  const rows = revenueForMonth(ym).slice().sort((a,b)=>a.date<b.date?-1:1);
  const editing = editingRevenueId ? state.dailyRevenue.find(r=>r.id===editingRevenueId) : null;
  return `
    <div class="topbar">
      <div><h1>Daily Entry</h1><div class="sub">One revenue row per day. ${monthLabel(ym)} is open for entry.</div></div>
    </div>

    ${canWrite() ? `
    <div class="form-card">
      <h3>${editing ? `Editing revenue for ${editing.date}` : `Add today's revenue`}</h3>
      <form id="form-daily">
        <div class="form-row">
          <div><label>Date</label><input type="date" name="date" value="${editing ? editing.date : todayISO()}" required></div>
          <div><label>Revenue (KES)</label><input type="number" name="revenue_kes" min="0" step="1" placeholder="0" value="${editing ? editing.revenue_kes : ''}" required></div>
          <div><label>Notes (optional)</label><input type="text" name="notes" placeholder="e.g. hotspot voucher promo" value="${editing ? (editing.notes||'') : ''}"></div>
        </div>
        <button class="btn gold" type="submit">${editing ? 'Update Revenue' : 'Add Revenue'}</button>
        ${editing ? `<button type="button" class="btn ghost" id="cancel-edit-daily">Cancel</button>` : ''}
        <div id="daily-err"></div>
      </form>
    </div>` : readOnlyNotice()}

    <div class="section-head"><h2>${monthLabel(ym)} â€” entries &amp; allocation</h2>
      <div class="toolbar"><button class="btn ghost sm" id="btn-export-revenue-csv">Export CSV</button></div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Revenue</th><th>Profit 5%</th><th>Owner/Debt 20%</th><th>Tax 15%</th><th>OpEx Budget 60%</th><th>Actual OpEx (net)</th><th>Variance</th><th></th></tr></thead>
      <tbody>
        ${rows.length===0 ? `<tr class="empty-row"><td colspan="9">No revenue entered yet for ${monthLabel(ym)}.</td></tr>` : rows.map(r=>{
          const alloc = pf(r.revenue_kes);
          const net = netExpenseOn(r.date);
          const variance = alloc.opex - net;
          return `<tr>
            <td class="txt">${r.date}</td>
            <td>${KES0(r.revenue_kes)}</td>
            <td>${KES0(alloc.profit)}</td>
            <td>${KES0(alloc.owner_debt)}</td>
            <td>${KES0(alloc.tax)}</td>
            <td>${KES0(alloc.opex)}</td>
            <td>${KES0(net)}</td>
            <td class="${variance<0?'neg':'pos'}">${variance<0?'-':'+'}${KES0(Math.abs(variance))}</td>
            <td>${canWrite() ? `<button class="btn ghost sm" data-edit-revenue="${r.id}">Edit</button> <button class="btn ghost sm" data-del-revenue="${r.id}">Delete</button>` : 'â€”'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>
  `;
}

/* ---------------- EXPENSES ---------------- */

let expenseFilters = {category:'', account:'', ownerFundedOnly:false, pendingOnly:false};
let editingRevenueId = null;
let editingExpenseId = null;
let editingLoanId = null;
let editingPaymentId = null;
let importResult = null; // {imported, skippedDupe, skippedInvalid, errors:[]}
let importing = false;

function filteredExpenseRows(){
  let rows = state.expenses.slice();
  if(expenseFilters.category) rows = rows.filter(e=>e.category===expenseFilters.category);
  if(expenseFilters.account) rows = rows.filter(e=>e.account_used===expenseFilters.account);
  if(expenseFilters.ownerFundedOnly) rows = rows.filter(e=>e.owner_funded);
  if(expenseFilters.pendingOnly) rows = rows.filter(e=>e.status==='pending_approval');
  rows.sort((a,b)=>a.date<b.date?-1:1);
  return rows;
}

function viewExpenses(){
  const ym = currentOpenMonth();
  let rows = filteredExpenseRows();
  const runningTotal = rows.reduce((s,e)=>s+e.amount_kes+e.charges_kes,0);
  const grossThisMonth = expensesForMonth(ym).reduce((s,e)=>s+e.amount_kes+e.charges_kes,0);
  const netThisMonth = monthTotals(ym).netOpex;
  const pendingCount = state.expenses.filter(e=>e.status==='pending_approval').length;
  const editing = editingExpenseId ? state.expenses.find(e=>e.id===editingExpenseId) : null;

  return `
    <div class="topbar">
      <div><h1>Expenses</h1><div class="sub">Every real money-out transaction. Duplicate transaction references are rejected outright.</div></div>
    </div>

    ${canWrite() ? `
    <div class="form-card">
      <h3>${editing ? `Editing expense "${editing.txn_ref}"` : `Log an expense`}</h3>
      <form id="form-expense">
        <div class="form-row">
          <div><label>Date</label><input type="date" name="date" value="${editing ? editing.date : todayISO()}" required></div>
          <div><label>Txn Ref</label><input type="text" name="txn_ref" placeholder="e.g. QK7X2ABC" value="${editing ? editing.txn_ref : ''}" required></div>
          <div><label>Account Used</label><select name="account_used">${ACCOUNTS.map(a=>`<option ${editing&&editing.account_used===a?'selected':''}>${a}</option>`).join('')}</select></div>
          <div><label>Category</label>
            <div style="display:flex; gap:6px;">
              <select name="category" style="flex:1;">${CATS().map(c=>`<option ${editing&&editing.category===c?'selected':''}>${c}</option>`).join('')}</select>
              <button type="button" class="btn ghost sm" id="btn-add-category" title="Add a new category">+ New</button>
            </div>
          </div>
        </div>
        <div class="form-row">
          <div><label>Description</label><input type="text" name="description" placeholder="What was this for?" value="${editing ? (editing.description||'') : ''}"></div>
          <div><label>Paid To (optional)</label><input type="text" name="paid_to" value="${editing ? (editing.paid_to||'') : ''}"></div>
          <div><label>Amount (KES)</label><input type="number" name="amount_kes" min="0" step="1" value="${editing ? editing.amount_kes : ''}" required></div>
          <div><label>Charges (KES)</label><input type="number" name="charges_kes" min="0" step="1" value="${editing ? editing.charges_kes : 0}"></div>
        </div>
        <div class="check-row" style="margin-bottom:12px;">
          <input type="checkbox" name="owner_funded" id="owner_funded" ${editing&&editing.owner_funded?'checked':''}><label for="owner_funded" style="text-transform:none; font-weight:500; margin:0; color:var(--ink-soft);">Paid using owner/related-party personal funds (not the OpEx account)</label>
        </div>
        ${!canApprove() ? `
        <div class="check-row" style="margin-bottom:12px;">
          <input type="checkbox" name="needs_approval" id="needs_approval" ${editing&&editing.status==='pending_approval'?'checked':''}><label for="needs_approval" style="text-transform:none; font-weight:500; margin:0; color:var(--ink-soft);">Submit for approval (won't count toward totals until a Branch Manager or Head Office approves it)</label>
        </div>` : ''}
        <button class="btn gold" type="submit">${editing ? 'Update Expense' : 'Log Expense'}</button>
        ${editing ? `<button type="button" class="btn ghost" id="cancel-edit-expense">Cancel</button>` : ''}
        <div id="expense-err"></div>
      </form>
    </div>

    <div class="form-card">
      <h3>Import expenses from a spreadsheet</h3>
      <div class="sub" style="margin-bottom:10px;">Upload an .xlsx or .csv export of your expense log (e.g. Tende Expense Log). Columns are matched by name â€” Date, Txn Ref, Account Used, Category, Description, Paid To, Amount (KES), Charges (KES), Owner/Related-Party Funded. Rows whose Txn Ref already exists â€” in the app or elsewhere in the same file â€” are skipped automatically, and the remaining rows are added in date order, oldest first.</div>
      <input type="file" id="file-import" accept=".xlsx,.xls,.csv">
      <div id="import-status" style="margin-top:10px;"></div>
      ${importResult ? `
        <div class="import-summary">
          <div><span class="tag good">${importResult.imported} imported</span></div>
          ${importResult.skippedDupe ? `<div><span class="tag neutral">${importResult.skippedDupe} skipped â€” duplicate Txn Ref</span></div>` : ''}
          ${importResult.skippedInvalid ? `<div><span class="tag alert">${importResult.skippedInvalid} skipped â€” missing/invalid data</span></div>` : ''}
        </div>
        ${importResult.errors.length ? `<details style="margin-top:8px;"><summary style="cursor:pointer; color:var(--muted); font-size:12.5px;">Show skipped rows</summary><ul style="font-size:12.5px; color:var(--ink-soft);">${importResult.errors.map(e=>`<li>${e}</li>`).join('')}</ul></details>` : ''}
      ` : ''}
    </div>` : readOnlyNotice()}

    <div class="summary-strip">
      <div class="item"><span>Gross OpEx (this month)</span><b>${KES(grossThisMonth)}</b></div>
      <div class="item"><span>Net OpEx (this month, feeds dashboard)</span><b>${KES(netThisMonth)}</b></div>
      <div class="item"><span>Owner-funded (this month)</span><b>${KES(grossThisMonth-netThisMonth)}</b></div>
    </div>

    <div class="section-head"><h2>All expenses</h2>
      <div class="toolbar">
        <select id="filter-category"><option value="">All categories</option>${CATS().map(c=>`<option ${expenseFilters.category===c?'selected':''}>${c}</option>`).join('')}</select>
        <select id="filter-account"><option value="">All accounts</option>${ACCOUNTS.map(a=>`<option ${expenseFilters.account===a?'selected':''}>${a}</option>`).join('')}</select>
        <label class="check-row" style="margin:0;"><input type="checkbox" id="filter-owner" ${expenseFilters.ownerFundedOnly?'checked':''}> Owner-funded only</label>
        ${canApprove() ? `<label class="check-row" style="margin:0;"><input type="checkbox" id="filter-pending" ${expenseFilters.pendingOnly?'checked':''}> Pending approval only${pendingCount>0?` (${pendingCount})`:''}</label>` : ''}
        <button class="btn ghost sm" id="btn-export-expenses-csv">Export CSV</button>
        <button class="btn ghost sm" id="btn-export-expenses-xlsx">Export .xlsx</button>
      </div>
    </div>
    ${attachmentsState.targetType==='expense' ? attachmentsPanelHtml() : ''}
    <div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Txn Ref</th><th>Account</th><th>Category</th><th class="txt">Description</th><th>Amount</th><th>Charges</th><th>Total</th><th>Owner-funded</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${rows.length===0 ? `<tr class="empty-row"><td colspan="11">No expenses match these filters.</td></tr>` : rows.map(e=>`
          <tr>
            <td class="txt">${e.date}</td>
            <td class="txt">${e.txn_ref}</td>
            <td class="txt">${e.account_used}</td>
            <td class="txt">${e.category}</td>
            <td class="txt">${e.description||''}</td>
            <td>${KES0(e.amount_kes)}</td>
            <td>${KES0(e.charges_kes)}</td>
            <td>${KES0(e.amount_kes+e.charges_kes)}</td>
            <td>${e.owner_funded? '<span class="tag neutral">Yes</span>':'â€”'}</td>
            <td class="txt">${statusTag(e.status)}</td>
            <td style="white-space:nowrap;">
              ${e.status==='pending_approval' && canApprove() ? `<button class="btn ghost sm" data-approve-expense="${e.id}">Approve</button> <button class="btn ghost sm" data-reject-expense="${e.id}">Reject</button> ` : ''}
              ${canWrite() ? `<button class="btn ghost sm" data-edit-expense="${e.id}">Edit</button> <button class="btn ghost sm" data-del-expense="${e.id}">Delete</button> ` : ''}<button class="btn ghost sm" data-attach-expense="${e.id}" title="Receipts / attachments">ðŸ“Ž</button>
            </td>
          </tr>`).join('')}
      </tbody>
      ${rows.length>0?`<tfoot><tr><td colspan="7" class="txt" style="font-weight:600;">Running total (filtered view)</td><td colspan="3" style="font-weight:700;">${KES0(runningTotal)}</td></tr></tfoot>`:''}
    </table></div>
  `;
}

/* ---------------- EXPENSE IMPORT (spreadsheet upload) ---------------- */

async function handleExpenseImport(ev){
  const file = ev.target.files[0];
  if(!file) return;
  const statusEl = document.getElementById('import-status');
  if(statusEl) statusEl.innerHTML = `<span class="hint">Reading ${file.name}â€¦</span>`;
  try{
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, {type:'array', cellDates:true});
    const wsName = wb.SheetNames.find(n=>/expense|tende/i.test(n)) || wb.SheetNames[0];
    const ws = wb.Sheets[wsName];
    const grid = XLSX.utils.sheet_to_json(ws, {header:1, raw:true, defval:null});

    const wants = {
      date: /^date$/i,
      txn_ref: /txn.*ref|reference/i,
      account_used: /account/i,
      category: /categor/i,
      description: /descri/i,
      paid_to: /paid ?to/i,
      amount_kes: /^amount\b|amount.*kes/i,
      charges_kes: /charge/i,
      owner_funded: /owner.*funded|related.?party/i
    };

    let headerRowIdx = -1, headerMap = {};
    for(let r=0;r<Math.min(grid.length,25);r++){
      const row = grid[r]||[];
      const rowStr = row.map(c=>String(c||'').trim());
      const hasDate = rowStr.some(c=>/^date$/i.test(c));
      const hasAmount = rowStr.some(c=>/amount/i.test(c));
      if(hasDate && hasAmount){
        headerRowIdx = r;
        row.forEach((cell,ci)=>{
          const c = String(cell||'').trim();
          for(const [key,re] of Object.entries(wants)){
            if(re.test(c) && !(key in headerMap)) headerMap[key]=ci;
          }
        });
        break;
      }
    }
    if(headerRowIdx===-1){
      importResult = {imported:0, skippedDupe:0, skippedInvalid:0, errors:['Could not find a header row containing a "Date" column and an "Amount" column â€” check the file matches the expected layout.']};
      if(statusEl) statusEl.innerHTML='';
      render(); return;
    }

    let imported=0, skippedDupe=0, skippedInvalid=0; const errors=[];
    const seenRefs = new Set(state.expenses.map(e=>e.txn_ref.toLowerCase()));
    const newRows = [];
    for(let r=headerRowIdx+1;r<grid.length;r++){
      const row = grid[r]||[];
      if(row.every(c=>c===null||c==='')) continue;
      const rawDate = headerMap.date!=null ? row[headerMap.date] : null;
      const rawRef = headerMap.txn_ref!=null ? row[headerMap.txn_ref] : null;
      const rawAmount = headerMap.amount_kes!=null ? row[headerMap.amount_kes] : null;
      if(rawDate==null || rawAmount==null || rawRef==null || String(rawRef).trim()===''){
        skippedInvalid++; continue;
      }
      let dateObj = rawDate instanceof Date ? rawDate : new Date(rawDate);
      if(isNaN(dateObj)){ skippedInvalid++; continue; }
      const dateStr = dateObj.toISOString().slice(0,10);
      const txn_ref = String(rawRef).trim();
      if(seenRefs.has(txn_ref.toLowerCase())){
        skippedDupe++; errors.push(`Row ${r+1}: Txn Ref "${txn_ref}" already exists â€” skipped`); continue;
      }
      const amount = Number(String(rawAmount).replace(/[^0-9.\-]/g,'')) || 0;
      const charges = headerMap.charges_kes!=null ? (Number(String(row[headerMap.charges_kes]||'0').replace(/[^0-9.\-]/g,''))||0) : 0;
      const ownerRaw = headerMap.owner_funded!=null ? String(row[headerMap.owner_funded]||'').trim().toUpperCase() : '';
      newRows.push({
        id:uid(), date:dateStr, txn_ref,
        account_used: headerMap.account_used!=null && row[headerMap.account_used] ? row[headerMap.account_used] : 'Bank Account',
        category: headerMap.category!=null && row[headerMap.category] ? row[headerMap.category] : 'Other',
        description: headerMap.description!=null ? (row[headerMap.description]||'') : '',
        paid_to: headerMap.paid_to!=null ? (row[headerMap.paid_to]||'') : '',
        amount_kes: amount, charges_kes: charges,
        owner_funded: ownerRaw==='Y'||ownerRaw==='YES'||ownerRaw==='TRUE'
      });
      seenRefs.add(txn_ref.toLowerCase());
      imported++;
    }
    // Insert in date order, oldest first -- matches how the original spreadsheet was arranged
    newRows.sort((a,b)=>a.date<b.date?-1:1);

    // Send the whole batch through the bulk import endpoint rather than
    // letting the generic background sync create them one at a time â€” this
    // re-checks duplicates server-side too (catches anything imported by
    // someone else since this session loaded) and reports exactly what it
    // skipped and why.
    let confirmedRows = [];
    if(newRows.length){
      if(statusEl) statusEl.innerHTML = `<span class="hint">Saving ${newRows.length} rowsâ€¦</span>`;
      try{
        const entries = newRows.map(CORE_ENTITY_CONFIG.expenses.toApi);
        const apiResult = await apiCreate('/api/expenses', { branch_id: state.branchId, entries });
        const insertedIds = new Set((apiResult.inserted||[]).map(x=>x.id));
        confirmedRows = newRows.filter(r=>insertedIds.has(r.id));
        for(const skip of (apiResult.skipped||[])){
          skippedDupe++;
          errors.push(skip.reason || 'A row was skipped by the server.');
        }
      }catch(err){
        importResult = {imported:0, skippedDupe, skippedInvalid, errors:[...errors, 'Save failed: '+err.message]};
        if(statusEl) statusEl.innerHTML='';
        render();
        ev.target.value = '';
        return;
      }
    }
    state.expenses = state.expenses.concat(confirmedRows);
    // Keep the sync snapshot in step so the debounced background save
    // doesn't try to re-create rows that are already persisted.
    if(lastSynced) lastSynced.expenses = JSON.parse(JSON.stringify(state.expenses));
    importResult = {imported: confirmedRows.length, skippedDupe, skippedInvalid, errors};
    render();
  } catch(err){
    importResult = {imported:0, skippedDupe:0, skippedInvalid:0, errors:['Could not read this file: '+err.message]};
    render();
  }
  ev.target.value = '';
}

/* ---------------- DEBT PAYOFF ---------------- */

function viewDebt(){
  const s = loanSummary();
  const rows = state.loans.slice();
  const editing = editingLoanId ? state.loans.find(l=>l.id===editingLoanId) : null;
  const paymentRows = state.loanPayments.slice().sort((a,b)=>a.date<b.date?-1:1);
  const editingP = editingPaymentId ? state.loanPayments.find(p=>p.id===editingPaymentId) : null;
  const loanName = id => (state.loans.find(l=>l.id===id)||{}).debt_name || '(deleted loan)';
  return `
    <div class="topbar"><div><h1>Debt Payoff Tracker</h1><div class="sub">Loan register and paydown progress.</div></div></div>

    <div class="grid kpi">
      <div class="card kpi"><h3>Total Original Debt</h3><div class="big" style="font-size:22px;">${KES(s.totalOriginal)}</div></div>
      <div class="card kpi"><h3>Balance Remaining</h3><div class="big" style="font-size:22px;">${KES(s.totalBalance)}</div></div>
      <div class="card kpi"><h3>% Cleared</h3><div class="big" style="font-size:22px;">${s.pctCleared.toFixed(0)}%</div></div>
      <div class="card kpi"><h3>Available This Month</h3><div class="big" style="font-size:22px;">${KES(s.availableThisMonth)}</div><div class="foot">${state.settings.debt_paydown_split_pct}% of Owner Pay &amp; Debt bucket</div></div>
      <div class="card kpi"><h3>Avg Monthly Paydown</h3><div class="big" style="font-size:22px;">${KES(s.avgMonthly)}</div></div>
      <div class="card kpi"><h3>Projected Debt-Free</h3><div class="big" style="font-size:20px;">${s.projectedDate}</div></div>
    </div>

    <div class="section-head"><h2>Loan register</h2></div>
    ${canWrite() ? `
    <div class="form-card">
      <h3>${editing ? `Editing "${editing.debt_name}"` : `Add a loan`}</h3>
      <form id="form-loan">
        <div class="form-row">
          <div><label>Debt Name</label><input type="text" name="debt_name" value="${editing?editing.debt_name:''}" required></div>
          <div><label>Lender</label><input type="text" name="lender" value="${editing?(editing.lender||''):''}"></div>
          <div><label>Original Principal</label><input type="number" name="original_principal_kes" min="0" value="${editing?editing.original_principal_kes:''}" required></div>
          <div><label>Current Balance</label><input type="number" name="current_balance_kes" min="0" value="${editing?editing.current_balance_kes:''}" required></div>
        </div>
        <div class="form-row">
          <div><label>Annual Interest %</label><input type="number" name="annual_interest_rate_pct" min="0" step="0.1" value="${editing?(editing.annual_interest_rate_pct||0):''}"></div>
          <div><label>Start Date</label><input type="date" name="start_date" value="${editing?(editing.start_date||''):''}"></div>
          <div><label>Min Monthly Payment</label><input type="number" name="min_monthly_payment_kes" min="0" value="${editing?(editing.min_monthly_payment_kes||0):''}"></div>
          <div><label>Status</label><select name="status"><option ${editing&&editing.status==='Active'?'selected':''}>Active</option><option ${editing&&editing.status==='Paid Off'?'selected':''}>Paid Off</option></select></div>
        </div>
        <button class="btn gold" type="submit">${editing?'Update Loan':'Add Loan'}</button>
        ${editing?`<button type="button" class="btn ghost" id="cancel-edit-loan">Cancel</button>`:''}
      </form>
    </div>` : readOnlyNotice()}

    <div class="table-wrap"><table>
      <thead><tr><th class="txt">Debt</th><th class="txt">Lender</th><th>Principal</th><th>Balance</th><th>Rate</th><th>Min Payment</th><th class="txt">Status</th><th></th></tr></thead>
      <tbody>
        ${rows.length===0?`<tr class="empty-row"><td colspan="8">No loans on file.</td></tr>`:rows.map(l=>`
          <tr>
            <td class="txt">${l.debt_name}</td><td class="txt">${l.lender||''}</td>
            <td>${KES0(l.original_principal_kes)}</td><td>${KES0(l.current_balance_kes)}</td>
            <td>${l.annual_interest_rate_pct||0}%</td><td>${KES0(l.min_monthly_payment_kes)}</td>
            <td class="txt"><span class="tag ${l.status==='Paid Off'?'good':'neutral'}">${l.status}</span></td>
            <td>${canWrite() ? `<button class="btn ghost sm" data-edit-loan="${l.id}">Edit</button> <button class="btn ghost sm" data-del-loan="${l.id}">Delete</button>` : 'â€”'}</td>
          </tr>`).join('')}
      </tbody>
    </table></div>

    ${canWrite() ? `
    <div class="section-head"><h2>${editingP ? 'Editing loan payment' : 'Log a loan payment'}</h2></div>
    <div class="form-card">
      <form id="form-payment">
        <div class="form-row">
          <div><label>Loan</label><select name="loan_id">${state.loans.map(l=>`<option value="${l.id}" ${editingP&&editingP.loan_id===l.id?'selected':''}>${l.debt_name}</option>`).join('')||'<option value="">No loans yet</option>'}</select></div>
          <div><label>Date</label><input type="date" name="date" value="${editingP?editingP.date:todayISO()}"></div>
          <div><label>Amount (KES)</label><input type="number" name="amount_kes" min="0" value="${editingP?editingP.amount_kes:''}" required></div>
          <div><label>Note</label><input type="text" name="note" value="${editingP?(editingP.note||''):''}"></div>
        </div>
        <button class="btn gold" type="submit" ${state.loans.length===0?'disabled':''}>${editingP?'Update Payment':'Log Payment'}</button>
        ${editingP?`<button type="button" class="btn ghost" id="cancel-edit-payment">Cancel</button>`:''}
        <div class="sub" style="margin-top:8px;">${editingP?'Editing a payment automatically corrects the loan balance to reflect the new amount.':'Logging a payment reduces the loan balance immediately.'}</div>
      </form>
    </div>` : `<div class="section-head"><h2>Loan payments</h2></div>`}

    <div class="table-wrap"><table>
      <thead><tr><th>Date</th><th class="txt">Loan</th><th>Amount</th><th class="txt">Note</th><th></th></tr></thead>
      <tbody>
        ${paymentRows.length===0?`<tr class="empty-row"><td colspan="5">No payments logged yet.</td></tr>`:paymentRows.map(p=>`
          <tr>
            <td class="txt">${p.date}</td>
            <td class="txt">${loanName(p.loan_id)}</td>
            <td>${KES0(p.amount_kes)}</td>
            <td class="txt">${p.note||''}</td>
            <td>${canWrite() ? `<button class="btn ghost sm" data-edit-payment="${p.id}">Edit</button> <button class="btn ghost sm" data-del-payment="${p.id}">Delete</button>` : 'â€”'}</td>
          </tr>`).join('')}
      </tbody>
    </table></div>
  `;
}

/* ---------------- TAX CALENDAR ---------------- */

function viewTax(){
  const d = dashboardData();
  const reserveBalance = Number(d.alloc?.tax||0);
  return `
    <div class="topbar"><div><h1>Tax Intelligence & Compliance</h1><div class="sub">Professional tax control centre. HFMS tracks obligations, periods, filing evidence, payments, reserve coverage and compliance status. Tax liabilities are never invented by the system.</div></div></div>

    <div class="grid kpi" id="tax-intelligence-kpis">
      <div class="card kpi"><h3>Outstanding Tax</h3><div class="big" id="tax-outstanding">Loadingâ€¦</div></div>
      <div class="card kpi"><h3>Due in 30 Days</h3><div class="big" id="tax-due30">Loadingâ€¦</div></div>
      <div class="card kpi"><h3>Overdue</h3><div class="big" id="tax-overdue">Loadingâ€¦</div></div>
      <div class="card kpi"><h3>Profit First Tax Reserve</h3><div class="big">${KES(reserveBalance)}</div></div>
    </div>

    <div class="form-card">
      <h3>Taxpayer & Compliance Profile</h3>
      <p class="hint">Store compliance metadata and TCC status separately from accounting balances. This does not file anything with KRA.</p>
      <div id="tax-profile-form" class="form-row">
        <div><label>Taxpayer name</label><input id="taxp-name" placeholder="Registered business name"></div>
        <div><label>KRA PIN</label><input id="taxp-pin" placeholder="PXXXXXXXXX"></div>
        <div><label>Accounting year-end month</label><input id="taxp-yearend" type="number" min="1" max="12" value="12"></div>
        <div><label>TCC status</label><select id="taxp-tcc"><option value="unknown">Unknown</option><option value="valid">Valid</option><option value="expiring">Expiring</option><option value="expired">Expired</option><option value="not_available">Not available</option></select></div>
        <div><label>TCC expiry</label><input id="taxp-tcc-expiry" type="date"></div>
        <div><label>eTIMS/TIMS compliant</label><select id="taxp-etims"><option value="">Not specified</option><option value="true">Yes</option><option value="false">No</option></select></div>
        <div><label>VAT registered</label><select id="taxp-vat"><option value="">Not specified</option><option value="true">Yes</option><option value="false">No</option></select></div>
        <div><label>Tax agent</label><input id="taxp-agent" placeholder="Name / firm"></div>
        <div><label>Agent contact</label><input id="taxp-agent-contact" placeholder="Phone / email"></div>
      </div>
      ${canWrite()?'<button class="btn gold" id="btn-save-tax-profile">Save Compliance Profile</button>':''}
      <div id="tax-profile-status" class="hint" style="margin-top:8px"></div>
    </div>

    <div class="form-card">
      <h3>Tax Period / Liability Register</h3>
      <p class="hint">Create a period only when the liability is known or intentionally set to NIL. The system can calculate deadlines from configured rules but will not fabricate the tax amount.</p>
      <div class="form-row">
        <div><label>Tax obligation</label><select id="tax-period-obligation"><option value="">Loadingâ€¦</option></select></div>
        <div><label>Period start</label><input id="tax-period-start" type="date"></div>
        <div><label>Period end</label><input id="tax-period-end" type="date"></div>
        <div><label>Amount due (KES)</label><input id="tax-period-amount" type="number" step="0.01" min="0" value="0"></div>
      </div>
      <div class="form-row">
        <div><label>Filing due date (optional override)</label><input id="tax-filing-due" type="date"></div>
        <div><label>Payment due date (optional override)</label><input id="tax-payment-due" type="date"></div>
        <div><label>Filing status</label><select id="tax-filing-status"><option value="not_due">Not due</option><option value="draft">Draft</option><option value="ready">Ready</option><option value="filed">Filed</option><option value="amended">Amended</option><option value="nil">NIL filed</option></select></div>
      </div>
      ${canWrite()?'<button class="btn gold" id="btn-create-tax-period">Create / Update Tax Period</button>':''}
      <div id="tax-period-status" class="hint" style="margin-top:8px"></div>
    </div>

    <div class="form-card">
      <h3>Compliance Command Centre</h3>
      <div id="tax-intelligence-table" style="overflow:auto">Loading tax intelligenceâ€¦</div>
    </div>

    <div class="form-card">
      <h3>Record Filing / Payment / Evidence</h3>
      <p class="hint">These actions create an auditable record. They do not submit returns or payments to KRA.</p>
      <div class="form-row">
        <div><label>Tax period</label><select id="tax-action-period"><option value="">Loadingâ€¦</option></select></div>
        <div><label>Filing reference</label><input id="tax-filing-reference" placeholder="Acknowledgement / return reference"></div>
        <div><label>Payment amount (KES)</label><input id="tax-payment-amount" type="number" step="0.01" min="0"></div>
        <div><label>Payment date</label><input id="tax-payment-date" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
        <div><label>Payment reference</label><input id="tax-payment-reference" placeholder="Bank / M-Pesa / KRA reference"></div>
      </div>
      ${canWrite()?'<button class="btn ghost" id="btn-mark-tax-filed">Mark Filed</button> <button class="btn gold" id="btn-record-tax-payment">Record Payment</button>':''}
      <div class="form-row" style="margin-top:10px">
        <div><label>Evidence type</label><select id="tax-evidence-type"><option value="return_acknowledgement">Return acknowledgement</option><option value="payment_slip">Payment slip</option><option value="payment_receipt">Payment receipt</option><option value="withholding_certificate">Withholding certificate</option><option value="tcc">TCC</option><option value="assessment">Assessment</option><option value="other">Other</option></select></div>
        <div><label>Evidence reference</label><input id="tax-evidence-reference"></div>
        <div><label>Storage path (optional)</label><input id="tax-evidence-path" placeholder="Supabase Storage path"></div>
      </div>
      ${canWrite()?'<button class="btn ghost" id="btn-add-tax-evidence">Attach Evidence Record</button>':''}
      <div id="tax-action-status" class="hint" style="margin-top:8px"></div>
    </div>

    <div class="form-card">
      <h3>Profit First Tax Reserve Coverage</h3>
      <div id="tax-reserve-analysis" class="narrative">Calculating reserve coverageâ€¦</div>
    </div>

    <div class="form-card">
      <h3>Authoritative Deadline Rules</h3>
      <p class="hint">These are reference rules sourced from KRA. Tax law can change; HFMS stores the source and verification date so management can review the rule before relying on it.</p>
      <div id="tax-rules-table" style="overflow:auto">Loadingâ€¦</div>
    </div>

    <div class="section-head"><h2>Legacy obligation register</h2></div>
    <div class="table-wrap"><table>
      <thead><tr><th class="txt">Tax Type</th><th class="txt">Applicable</th><th class="txt">Frequency</th><th>Due</th><th>Est. Amount</th><th class="txt">Authority</th><th></th></tr></thead>
      <tbody>${state.taxObligations.map(t=>`<tr><td class="txt">${t.tax_type}</td><td class="txt"><input type="checkbox" data-tax-applicable="${t.id}" ${t.applicable?'checked':''} ${canWrite()?'':'disabled'}></td><td class="txt"><select data-tax-frequency="${t.id}" ${canWrite()?'':'disabled'}>${['Monthly','Quarterly','Annual'].map(f=>`<option ${t.frequency===f?'selected':''}>${f}</option>`).join('')}</select></td><td class="txt">${t.frequency==='Monthly'?`Day <input style="width:52px;display:inline;padding:4px 6px;" type="number" min="1" max="28" data-tax-dueday="${t.id}" value="${t.due_day_of_month}" ${canWrite()?'':'disabled'}>`:`<input type="date" data-tax-manualdue="${t.id}" value="${t.manual_next_due_date||''}" ${canWrite()?'':'disabled'}>`}</td><td><input style="width:110px;" type="number" min="0" data-tax-amount="${t.id}" value="${t.estimated_amount_kes}" ${canWrite()?'':'disabled'}></td><td class="txt"><input style="width:100px;" type="text" data-tax-authority="${t.id}" value="${t.filing_authority}" ${canWrite()?'':'disabled'}></td><td>${canWrite()?`<button class="btn ghost sm" data-del-tax="${t.id}">Remove</button>`:''}</td></tr>`).join('')}</tbody>
    </table></div>
    ${canWrite()?`<div class="section-head"></div><button class="btn ghost sm" id="btn-add-tax">+ Add custom tax type</button>`:''}
  `;
}


/* ---------------- TREND ARCHIVE ---------------- */

function viewArchive(){
  const rows = state.monthlyArchive.slice().sort((a,b)=>a.month<b.month?1:-1);
  return `
    <div class="topbar"><div><h1>Trend Archive</h1><div class="sub">One row per closed month. Read-only â€” created by "Close Month" on the Dashboard.</div></div>
      <div class="topbar-actions"><button class="btn ghost sm" id="btn-export-archive-xlsx">Export .xlsx</button></div>
    </div>

    <div class="chart-box"><h3>Revenue vs Net OpEx</h3><div class="chart-canvas-wrap"><canvas id="chart-rev-opex"></canvas></div></div>
    <div class="grid" style="grid-template-columns:1fr 1fr;">
      <div class="chart-box"><h3>OpEx Ratio %</h3><div class="chart-canvas-wrap"><canvas id="chart-opex-ratio"></canvas></div></div>
      <div class="chart-box"><h3>Revenue Achievement %</h3><div class="chart-canvas-wrap"><canvas id="chart-rev-achieve"></canvas></div></div>
    </div>

    <div class="section-head"><h2>Archived months â€” budget vs. actual</h2></div>
    <div class="table-wrap"><table>
      <thead><tr><th class="txt">Month</th><th>Revenue</th><th>Daily Avg</th><th>Profit</th><th>Owner/Debt</th><th>Tax Reserve</th><th>OpEx Budget</th><th>Actual OpEx</th><th>Variance</th><th>OpEx Ratio</th><th>Rev Achv.</th></tr></thead>
      <tbody>
        ${rows.length===0?`<tr class="empty-row"><td colspan="11">No months closed yet.</td></tr>`:rows.map(a=>{
          const variance = a.opex_budget_kes - a.actual_opex_kes;
          return `
          <tr>
            <td class="txt">${a.month_label}</td>
            <td>${KES0(a.total_revenue_kes)}</td><td>${KES0(a.daily_avg_revenue_kes)}</td>
            <td>${KES0(a.profit_reserved_kes)}</td><td>${KES0(a.owner_pay_allocated_kes)}</td>
            <td>${KES0(a.tax_reserve_kes)}</td><td>${KES0(a.opex_budget_kes)}</td><td>${KES0(a.actual_opex_kes)}</td>
            <td class="${variance<0?'neg':'pos'}">${variance<0?'-':'+'}${KES0(Math.abs(variance))}</td>
            <td>${a.opex_ratio_pct.toFixed(1)}%</td><td>${a.revenue_achievement_pct.toFixed(0)}%</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table></div>

    ${state.isHeadOffice && state.allBranches && state.allBranches.length > 1 ? `
    <div class="section-head"><h2>Branch comparison â€” current month</h2>
      <div class="toolbar"><span class="hint">${branchCompareState.loading ? 'Loadingâ€¦' : ''}</span></div>
    </div>
    <div class="card">
      ${branchCompareState.error ? `<div class="hint" style="color:#c0392b;">${branchCompareState.error}</div>` : ''}
      ${branchCompareState.rows ? `
      <div class="table-wrap"><table>
        <thead><tr><th class="txt">Branch</th><th>Revenue (MTD)</th><th>Expenses (MTD)</th><th>Net</th></tr></thead>
        <tbody>
          ${branchCompareState.rows.map(r=>`
            <tr>
              <td class="txt">${r.name}${r.branch_id===state.branchId?' <span class="tag neutral">Current</span>':''}</td>
              <td>${KES0(r.revenue)}</td><td>${KES0(r.expenses)}</td>
              <td class="${r.revenue-r.expenses<0?'neg':'pos'}">${KES0(r.revenue-r.expenses)}</td>
            </tr>`).join('')}
        </tbody>
      </table></div>` : (branchCompareState.loading ? '' : `<button class="btn ghost sm" id="btn-load-branch-compare">Load comparison</button>`)}
    </div>` : ''}
  `;
}

let branchCompareState = { loading:false, rows:null, error:null };
async function loadBranchCompare(){
  branchCompareState = { loading:true, rows:null, error:null };
  render();
  try{
    const ym = currentOpenMonth();
    const rows = await Promise.all(state.allBranches.map(async b => {
      const [revRes, expRes] = await Promise.all([
        apiList('/api/revenue', b.branch_id),
        apiList('/api/expenses', b.branch_id)
      ]);
      const revenue = (revRes.revenue||[]).filter(r=>monthKey(r.entry_date)===ym).reduce((s,r)=>s+Number(r.amount_kes),0);
      const expenses = (expRes.expenses||[])
        .filter(e=>monthKey(e.expense_date)===ym && e.status!=='pending_approval' && e.status!=='rejected')
        .reduce((s,e)=>s+Number(e.amount_kes)+Number(e.charges_kes||0),0);
      return { branch_id: b.branch_id, name: b.name, revenue, expenses };
    }));
    branchCompareState = { loading:false, rows, error:null };
  }catch(e){
    branchCompareState = { loading:false, rows:null, error:e.message };
  }
  render();
}

let chartRefs = {};
function drawArchiveCharts(){
  const rows = state.monthlyArchive.slice().sort((a,b)=>a.month<b.month?-1:1);
  const labels = rows.map(r=>r.month_label);
  Object.values(chartRefs).forEach(c=>c && c.destroy());
  if(!window.Chart || rows.length===0){ chartRefs={}; return; }
  const inkSoft = '#3B4B63', gold='#D9A441', good='#2F7A5C';
  chartRefs.revOpex = new Chart(document.getElementById('chart-rev-opex'), {
    type:'bar',
    data:{labels, datasets:[
      {label:'Revenue', data:rows.map(r=>r.total_revenue_kes), backgroundColor:gold},
      {label:'Net OpEx', data:rows.map(r=>r.actual_opex_kes), backgroundColor:inkSoft}
    ]},
    options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}}}
  });
  chartRefs.ratio = new Chart(document.getElementById('chart-opex-ratio'), {
    type:'line', data:{labels, datasets:[{label:'OpEx Ratio %', data:rows.map(r=>r.opex_ratio_pct), borderColor:inkSoft, tension:.3}]},
    options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}}
  });
  chartRefs.achv = new Chart(document.getElementById('chart-rev-achieve'), {
    type:'line', data:{labels, datasets:[{label:'Revenue Achievement %', data:rows.map(r=>r.revenue_achievement_pct), borderColor:good, tension:.3}]},
    options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}}
  });
}

/* ---------------- SETTINGS ---------------- */

function viewSettings(){
  const s = state.settings;
  const pctSum = Number(s.pct_profit)+Number(s.pct_owner_debt)+Number(s.pct_tax)+Number(s.pct_opex);
  return `
    <div class="topbar"><div><h1>Settings</h1><div class="sub">Allocation percentages must sum to 100%.</div></div></div>

    ${canManageSettings() ? `
    <div class="form-card">
      <h3>Profit First allocation</h3>
      <form id="form-settings">
        <div class="form-row">
          <div><label>Profit %</label><input type="number" name="pct_profit" min="0" max="100" step="0.5" value="${s.pct_profit}"></div>
          <div><label>Owner Pay &amp; Debt %</label><input type="number" name="pct_owner_debt" min="0" max="100" step="0.5" value="${s.pct_owner_debt}"></div>
          <div><label>Tax Reserve %</label><input type="number" name="pct_tax" min="0" max="100" step="0.5" value="${s.pct_tax}"></div>
          <div><label>OpEx %</label><input type="number" name="pct_opex" min="0" max="100" step="0.5" value="${s.pct_opex}"></div>
        </div>
        <div class="hint" style="margin-bottom:12px;">Current sum: <b>${pctSum}%</b> ${pctSum!==100?'â€” must equal 100% to save':''}</div>
        <div class="form-row">
          <div><label>Debt paydown split % (of Owner Pay &amp; Debt bucket)</label><input type="number" name="debt_paydown_split_pct" min="0" max="100" value="${s.debt_paydown_split_pct}"></div>
          <div><label>Monthly revenue target (KES)</label><input type="number" name="monthly_revenue_target_kes" min="0" value="${s.monthly_revenue_target_kes}"></div>
          <div><label>Opening OpEx account balance (KES)</label><input type="number" name="opening_opex_account_balance_kes" min="0" value="${s.opening_opex_account_balance_kes}"></div>
        </div>
        <button class="btn gold" type="submit">Save Settings</button>
        <div id="settings-err"></div>
      </form>
    </div>` : `
    <div class="form-card">
      <h3>Profit First allocation</h3>
      <div class="hint" style="display:flex; align-items:center; gap:8px; margin-bottom:14px;">${ic('lock',14)}Only Head Office or the Branch Manager can change this split.</div>
      <div class="form-row">
        <div><label>Profit %</label><div class="big" style="font-size:18px;">${s.pct_profit}%</div></div>
        <div><label>Owner Pay &amp; Debt %</label><div class="big" style="font-size:18px;">${s.pct_owner_debt}%</div></div>
        <div><label>Tax Reserve %</label><div class="big" style="font-size:18px;">${s.pct_tax}%</div></div>
        <div><label>OpEx %</label><div class="big" style="font-size:18px;">${s.pct_opex}%</div></div>
      </div>
    </div>`}

    <div class="section-head"><h2>Expense categories</h2></div>
    <div class="card">
      <div class="sub" style="margin-bottom:10px;">These appear in the category dropdown when logging or filtering expenses. Add or remove them to match how Happynet actually spends money.</div>
      <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
        ${CATS().map(c=>`<span class="tag neutral" style="gap:8px;">${c}${canWrite()?`<button type="button" data-del-category="${c}" style="all:unset; cursor:pointer; font-weight:700;">&times;</button>`:''}</span>`).join('')}
      </div>
      ${canWrite() ? `<button class="btn ghost sm" id="btn-add-category-settings">+ Add category</button>` : ''}
    </div>

    <div class="section-head"><h2>Data</h2></div>
    <div class="card" style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
      <button class="btn ghost" id="btn-export">Export all data (JSON)</button>
      <span class="hint">Everything lives in one place â€” no duplicate copies to keep in sync.</span>
    </div>
  `;
}
