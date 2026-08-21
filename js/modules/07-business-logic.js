/* Extracted from app.js; load order is intentional. */
/* ---------------- Derived / business logic ---------------- */

function pf(revenue){
  const s = state.settings;
  return {
    profit: revenue * s.pct_profit/100,
    owner_debt: revenue * s.pct_owner_debt/100,
    tax: revenue * s.pct_tax/100,
    opex: revenue * s.pct_opex/100
  };
}

function currentOpenMonth(){
  const active = state.dailyRevenue
    .map(r => monthKey(r.date))
    .filter(m => !state.closedMonths.includes(m));
  if(active.length === 0) return monthKey(todayISO());
  return active.sort().slice(-1)[0];
}

function revenueForMonth(ym){ return state.dailyRevenue.filter(r => monthKey(r.date) === ym); }
// Pending-approval and rejected expenses are real rows (visible, editable,
// approvable) but shouldn't move any money total until a Branch Manager or
// Head Office approves them ” this is the one place that filter needs to
// live, since every other total is built from these two functions.
function postedExpenses(){ return state.expenses.filter(e => e.status !== 'pending_approval' && e.status !== 'rejected'); }
function statusTag(status){
  if(status==='pending_approval') return `<span class="tag neutral" style="background:#F7EDD8; color:var(--gold-deep);">Pending</span>`;
  if(status==='rejected') return `<span class="tag alert">Rejected</span>`;
  return `<span class="tag good">Posted</span>`;
}
async function approveExpense(id){
  try{
    await apiUpdate('/api/expenses', { branch_id: state.branchId, id, status:'posted', approve:true });
    const rec = state.expenses.find(e=>e.id===id);
    if(rec) rec.status = 'posted';
    lastSynced.expenses = JSON.parse(JSON.stringify(state.expenses));
    render();
  }catch(e){ alert('Could not approve: '+e.message); }
}
async function rejectExpense(id){
  try{
    await apiUpdate('/api/expenses', { branch_id: state.branchId, id, status:'rejected' });
    const rec = state.expenses.find(e=>e.id===id);
    if(rec) rec.status = 'rejected';
    lastSynced.expenses = JSON.parse(JSON.stringify(state.expenses));
    render();
  }catch(e){ alert('Could not reject: '+e.message); }
}
function expensesForMonth(ym){ return postedExpenses().filter(e => monthKey(e.date) === ym); }

function grossExpenseOn(date){ return postedExpenses().filter(e=>e.date===date).reduce((s,e)=>s+e.amount_kes+e.charges_kes,0); }
function ownerFundedOn(date){ return postedExpenses().filter(e=>e.date===date && e.owner_funded).reduce((s,e)=>s+e.amount_kes+e.charges_kes,0); }
function netExpenseOn(date){ return grossExpenseOn(date) - ownerFundedOn(date); }

function monthTotals(ym){
  const revRows = revenueForMonth(ym);
  const expRows = expensesForMonth(ym);
  const totalRevenue = revRows.reduce((s,r)=>s+r.revenue_kes,0);
  const grossOpex = expRows.reduce((s,e)=>s+e.amount_kes+e.charges_kes,0);
  const ownerFunded = expRows.filter(e=>e.owner_funded).reduce((s,e)=>s+e.amount_kes+e.charges_kes,0);
  const netOpex = grossOpex - ownerFunded;
  const alloc = pf(totalRevenue);
  const daysElapsed = revRows.length;
  const dim = daysInMonth(ym);
  return { totalRevenue, grossOpex, ownerFunded, netOpex, alloc, daysElapsed, dim, revRows, expRows };
}

function dashboardData(){
  const ym = currentOpenMonth();
  const t = monthTotals(ym);
  const target = state.settings.monthly_revenue_target_kes;
  const paceTarget = target * (t.daysElapsed / t.dim);
  const revenuePacePct = paceTarget > 0 ? (t.totalRevenue / paceTarget) * 100 : 0;
  const opexPacePct = t.alloc.opex > 0 ? (t.netOpex / t.alloc.opex) * 100 : 0;
  const projRevenue = t.daysElapsed > 0 ? (t.totalRevenue / t.daysElapsed) * t.dim : 0;
  const projOpex = t.daysElapsed > 0 ? (t.netOpex / t.daysElapsed) * t.dim : 0;
  const overspent = t.netOpex > t.alloc.opex;
  const opexVariance = t.alloc.opex - t.netOpex;
  return { ym, ...t, target, revenuePacePct, opexPacePct, projRevenue, projOpex, overspent, opexVariance };
}

function narrativeText(d){
  const monthName = monthLabel(d.ym);
  const revStatus = d.revenuePacePct >= 100 ? 'ahead of pace' : d.revenuePacePct >= 85 ? 'close to pace' : 'behind pace';
  const opexStatus = d.overspent ? `overspent by ${KES(Math.abs(d.opexVariance))}` : `within budget with ${KES(d.opexVariance)} left`;
  const projLine = d.projRevenue >= d.target
    ? `If this pace holds, ${monthName} should close above the ${KES(d.target)} target.`
    : `If this pace holds, ${monthName} will land around ${KES(d.projRevenue)}, short of the ${KES(d.target)} target.`;
  return `Day ${d.daysElapsed} of ${d.dim} in ${monthName}: revenue is ${revStatus} at ${d.revenuePacePct.toFixed(0)}% of target pace, `+
    `and Operating Expenses are ${opexStatus} against the ${KES(d.alloc.opex)} allocated so far. ${projLine} `+
    `Projected month-end OpEx sits at ${KES(d.projOpex)}.`;
}

function signalLevel(pct){
  if(pct >= 100) return 4;
  if(pct >= 80) return 3;
  if(pct >= 50) return 2;
  return 1;
}

function loanSummary(){
  const totalOriginal = state.loans.reduce((s,l)=>s+Number(l.original_principal_kes||0),0);
  const totalBalance = state.loans.reduce((s,l)=>s+Number(l.current_balance_kes||0),0);
  const pctCleared = totalOriginal > 0 ? ((totalOriginal-totalBalance)/totalOriginal)*100 : 0;
  const ym = currentOpenMonth();
  const t = monthTotals(ym);
  const availableThisMonth = t.alloc.owner_debt * (state.settings.debt_paydown_split_pct/100);
  // average monthly paydown across months with payments
  const byMonth = {};
  state.loanPayments.forEach(p => { const m = monthKey(p.date); byMonth[m]=(byMonth[m]||0)+Number(p.amount_kes||0); });
  const months = Object.keys(byMonth);
  const avgMonthly = months.length ? Object.values(byMonth).reduce((a,b)=>a+b,0)/months.length : 0;
  let projectedDate = 'Not enough data yet';
  if(avgMonthly > 0 && totalBalance > 0){
    const monthsLeft = Math.ceil(totalBalance/avgMonthly);
    const d = new Date(); d.setMonth(d.getMonth()+monthsLeft);
    projectedDate = d.toLocaleString('en-US',{month:'long',year:'numeric'});
  } else if(totalBalance <= 0 && state.loans.length){
    projectedDate = 'Debt-free';
  }
  return { totalOriginal, totalBalance, pctCleared, availableThisMonth, avgMonthly, projectedDate };
}


async function importFinancialSource(sourceSystem, fileName, rows){
  const res = await apiFetch('/api/import-financials', {
    method:'POST', headers:JSONH,
    body:JSON.stringify({branch_id:state.branchId, source_system:sourceSystem, file_name:fileName, rows})
  });
  const b=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(b.error||'Import failed');
  return b;
}
function parseCSVRobust(text){
  const rows=[]; let row=[], field='', quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i], n=text[i+1];
    if(quoted){
      if(c==='"' && n==='"'){field+='"';i++;}
      else if(c==='"') quoted=false;
      else field+=c;
    }else{
      if(c==='"') quoted=true;
      else if(c===','){row.push(field);field='';}
      else if(c==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}
      else field+=c;
    }
  }
  if(field.length||row.length){row.push(field);rows.push(row);}
  return rows;
}
function rowsToObjects(rows){
  if(!rows.length) return [];
  const headers=rows[0].map(x=>String(x||'').trim());
  return rows.slice(1).filter(r=>r.some(x=>String(x||'').trim()!=='')).map(r=>{
    const o={}; headers.forEach((h,i)=>o[h]=r[i]??''); return o;
  });
}
function parseTendeCSV(text){
  return rowsToObjects(parseCSVRobust(text)).map(r=>({
    source_ref:r['REF'], ref:r['REF'], date_initiated:r['DATE INITIATED'],
    service:r['SERVICE'], amount:r['AMOUNT'], charge:r['CHARGE'], receiver:r['RECEIVER'],
    name:r['NAME'], remark:r['REMARK'], ref_no:r['REF NO'], status:r['STATUS'],
    status_message:r['STATUS MESSAGE']
  }));
}
function parseUtilityCSV(text){
  const rows=parseCSVRobust(text);
  const headerIndex=rows.findIndex(r=>String(r[0]||'').trim()==='Receipt No.');
  if(headerIndex<0) throw new Error('This does not look like an Organization Utility Account export.');
  return rowsToObjects(rows.slice(headerIndex)).map(r=>({
    source_ref:r['Receipt No.'], receipt_no:r['Receipt No.'],
    completion_time:r['Completion Time'], details:r['Details'],
    transaction_status:r['Transaction Status'], paid_in:r['Paid In'],
    withdrawn:r['Withdrawn'], reason_type:r['Reason Type'],
    other_party_info:r['Other Party Info'], linked_transaction_id:r['Linked Transaction ID']
  }));
}
async function handleFinancialImportFiles(files){
  const status=document.getElementById('financial-import-status');
  if(!files.length) return;
  status.innerHTML='Processing files¦';
  const reports=[];
  try{
    for(const file of files){
      const text=await file.text();
      const lower=file.name.toLowerCase();
      let source, rows;
      if(lower.includes('utilityaccount') || text.includes('Utility Account to Organization Settlement Account')) {
        source='organization_utility'; rows=parseUtilityCSV(text);
      } else if(lower.includes('tende') || text.includes('DATE INITIATED') && text.includes('SERVICE')) {
        source='tende'; rows=parseTendeCSV(text);
      } else throw new Error(`${file.name}: unsupported financial export.`);
      const r=await importFinancialSource(source,file.name,rows);
      reports.push(`${file.name}: ${r.created.length} posted, ${r.skipped.length} duplicate/skipped, ${r.review.length} held for review, ${r.errors.length} errors`);
    }
    status.innerHTML=reports.map(x=>`<div class="tag good">${x}</div>`).join('');
    if(typeof loadData==='function') await loadData();
    render();
  }catch(e){status.innerHTML=`<div class="err-msg">${e.message}</div>`;}
}
function viewFinancialImports(){
  return `
  <div class="topbar"><div><h1>Financial Data Center</h1>
    <div class="sub">Single source of truth for Happynet revenue, expenses and owner funding.</div></div></div>
  <div class="narrative"><b>Automatic classification</b> ” Organization Utility settlements are posted as revenue. Successful Tende outgoing payments are posted as expenses. Successful Tende incoming payments are posted as <b>John / Owner Loan Funding</b>. The raw payer details are retained for audit and verification.</div>
  <div class="section-head"><h2>Import official source files</h2></div>
  <div class="form-card">
    <div class="form-row">
      <div><label>Tende payments export</label><input id="import-tende" type="file" accept=".csv"></div>
      <div><label>Organization Utility Account export</label><input id="import-utility" type="file" accept=".csv"></div>
    </div>
    <div class="hint">Upload the files exactly as downloaded. Do not edit, rename columns, or manually calculate totals. The importer is duplicate-safe.</div>
    <div style="margin-top:14px"><button class="btn gold" id="btn-run-financial-import">Import & Reconcile</button></div>
    <div id="financial-import-status" class="import-summary"></div>
  </div>
  <div class="section-head"><h2>Posting rules</h2></div>
  <div class="table-wrap"><table>
    <thead><tr><th>Source</th><th>Rule</th><th>System treatment</th></tr></thead>
    <tbody>
      <tr><td class="txt">Organization Utility</td><td class="txt">Completed settlement to organization</td><td class="txt pos">Revenue</td></tr>
      <tr><td class="txt">Tende</td><td class="txt">Successful outgoing payment</td><td class="txt neg">Expense + charge</td></tr>
      <tr><td class="txt">Tende</td><td class="txt">Successful incoming payment</td><td class="txt">John / Owner loan funding</td></tr>
      <tr><td class="txt">Tende</td><td class="txt">Other incoming payment</td><td class="txt">Review queue ” never assumed revenue</td></tr>
    </tbody>
  </table></div>`;
}

