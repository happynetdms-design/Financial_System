/* Extracted from app.js; load order is intentional. */
/* ---------------- CSV export (Phase 5) ---------------- */
function csvEscape(v){
  const s = v===null||v===undefined ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
}
function toCsv(headers, rows){
  const lines = [headers.map(csvEscape).join(',')];
  for(const row of rows) lines.push(row.map(csvEscape).join(','));
  return lines.join('\r\n');
}
function downloadText(filename, text, mime){
  const blob = new Blob([text], { type: mime || 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function exportExpensesCsv(){
  const rows = filteredExpenseRows();
  const csv = toCsv(
    ['Date','Txn Ref','Account','Category','Description','Paid To','Amount (KES)','Charges (KES)','Total (KES)','Owner Funded','Status'],
    rows.map(e => [e.date, e.txn_ref, e.account_used, e.category, e.description||'', e.paid_to||'',
      e.amount_kes, e.charges_kes, e.amount_kes+e.charges_kes, e.owner_funded ? 'Yes' : 'No', e.status])
  );
  downloadText(`happynet-expenses-${todayISO()}.csv`, csv);
}
function exportExpensesXlsx(){
  const rows = filteredExpenseRows();
  const sheetRows = rows.map(e => ({
    'Date': e.date, 'Txn Ref': e.txn_ref, 'Account': e.account_used, 'Category': e.category,
    'Description': e.description||'', 'Paid To': e.paid_to||'',
    'Amount (KES)': e.amount_kes, 'Charges (KES)': e.charges_kes, 'Total (KES)': e.amount_kes+e.charges_kes,
    'Owner Funded': e.owner_funded ? 'Yes' : 'No', 'Status': e.status
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetRows), 'Expenses');
  XLSX.writeFile(wb, `happynet-expenses-${todayISO()}.xlsx`);
}
function exportRevenueCsv(){
  const rows = state.dailyRevenue.slice().sort((a,b)=>a.date<b.date?-1:1);
  const csv = toCsv(
    ['Date','Revenue (KES)','Notes'],
    rows.map(r => [r.date, r.revenue_kes, r.notes||''])
  );
  downloadText(`happynet-revenue-${todayISO()}.csv`, csv);
}

/* ---------------- .xlsx export (Phase 5) — uses the SheetJS build already
   loaded for the Tende import parser, so no extra dependency. ---------------- */
function exportArchiveXlsx(){
  const rows = state.monthlyArchive.slice().sort((a,b)=>a.month<b.month?1:-1);
  const sheetRows = rows.map(a => ({
    'Month': a.month_label,
    'Revenue (KES)': a.total_revenue_kes,
    'Daily Avg (KES)': a.daily_avg_revenue_kes,
    'Profit (KES)': a.profit_reserved_kes,
    'Owner/Debt (KES)': a.owner_pay_allocated_kes,
    'Tax Reserve (KES)': a.tax_reserve_kes,
    'OpEx Budget (KES)': a.opex_budget_kes,
    'Actual OpEx (KES)': a.actual_opex_kes,
    'Variance (KES)': a.opex_budget_kes - a.actual_opex_kes,
    'OpEx Ratio %': Number(a.opex_ratio_pct.toFixed(1)),
    'Revenue Achievement %': Number(a.revenue_achievement_pct.toFixed(0))
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetRows), 'Trend Archive');
  XLSX.writeFile(wb, `happynet-trend-archive-${todayISO()}.xlsx`);
}

/* ---------------- Receipts / attachments (Phase 4) ---------------- */
let attachmentsState = { targetType:null, targetId:null, items:null, loading:false, error:null };

async function openAttachments(entityType, entityId){
  attachmentsState = { targetType: entityType, targetId: entityId, items: null, loading: true, error: null };
  render();
  try{
    const res = await apiList('/api/attachments', state.branchId, { entity_type: entityType, entity_id: entityId });
    attachmentsState.items = res.attachments || [];
  }catch(e){
    attachmentsState.items = [];
    attachmentsState.error = e.message;
  }
  attachmentsState.loading = false;
  render();
}
function closeAttachments(){
  attachmentsState = { targetType:null, targetId:null, items:null, loading:false, error:null };
  render();
}
async function uploadAttachment(entityType, entityId, file){
  if(!file) return;
  const dataUrl = await new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result);
    reader.onerror = () => rej(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
  const base64 = dataUrl.split(',')[1] || '';
  attachmentsState.loading = true; render();
  try{
    await apiCreate('/api/attachments', {
      branch_id: state.branchId, entity_type: entityType, entity_id: entityId,
      file_name: file.name, content_type: file.type || 'application/octet-stream', data_base64: base64
    });
    await openAttachments(entityType, entityId); // refresh the list with the new file included
  }catch(e){
    attachmentsState.loading = false;
    attachmentsState.error = e.message;
    render();
  }
}
async function deleteAttachment(id){
  attachmentsState.loading = true; render();
  try{
    await apiRemove('/api/attachments', { branch_id: state.branchId, id });
    await openAttachments(attachmentsState.targetType, attachmentsState.targetId);
  }catch(e){
    attachmentsState.loading = false;
    attachmentsState.error = e.message;
    render();
  }
}
function attachmentsPanelHtml(){
  if(!attachmentsState.targetId) return '';
  const { items, loading, error } = attachmentsState;
  return `<div class="panel" style="margin:10px 0;">
    <div class="section-head"><h3 style="margin:0;">Receipts / attachments</h3><button class="btn ghost sm" data-close-attachments>Close</button></div>
    ${error ? `<div class="hint" style="color:#c0392b;">${error}</div>` : ''}
    ${loading ? '<span class="hint">Working…</span>' :
      (items && items.length
        ? items.map(a => `<div class="item"><a href="${a.url || '#'}" target="_blank" rel="noopener">${(a.storage_path||'').split('/').pop()}</a> ${canWrite() ? `<button class="btn ghost sm" data-del-attachment="${a.id}">Remove</button>` : ''}</div>`).join('')
        : '<span class="hint">No attachments yet.</span>')}
    ${canWrite() ? `<div style="margin-top:8px;"><input type="file" id="attachment-file-input" accept="image/*,.pdf"></div>` : ''}
  </div>`;
}
function wireAttachmentsPanel(){
  const closeBtn = document.querySelector('[data-close-attachments]');
  if(closeBtn) closeBtn.addEventListener('click', closeAttachments);
  document.querySelectorAll('[data-del-attachment]').forEach(b => b.addEventListener('click', () => {
    deleteAttachment(b.dataset.delAttachment);
  }));
  const fileInput = document.getElementById('attachment-file-input');
  if(fileInput) fileInput.addEventListener('change', (ev) => {
    uploadAttachment(attachmentsState.targetType, attachmentsState.targetId, ev.target.files[0]);
  });
}

/* ---------------- Flexible Case-Insensitive Importer ---------------- */
function normalizeHeader(str) {
  return String(str || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findColumnIndex(headers, targetVariations) {
  const normalizedTargets = targetVariations.map(normalizeHeader);
  return headers.findIndex(h => normalizedTargets.includes(normalizeHeader(h)));
}

async function importExpensesFromFile(file) {
  if (!file) return;

  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (!rawRows || rawRows.length < 2) {
    throw new Error('The uploaded file is empty or missing data rows.');
  }

  const headers = rawRows[0];

  const dateIdx = findColumnIndex(headers, ['Date', 'date', 'DATE', 'Txn Date', 'Transaction Date', 'Date Logged']);
  const amountIdx = findColumnIndex(headers, ['Amount', 'amount', 'AMOUNT', 'Amount (KES)', 'Total', 'Total (KES)', 'Cost']);
  const txnRefIdx = findColumnIndex(headers, ['Txn Ref', 'txn_ref', 'TxnRef', 'Reference', 'Receipt No', 'Ref']);
  const accountIdx = findColumnIndex(headers, ['Account Used', 'account_used', 'Account', 'Payment Method', 'Source']);
  const categoryIdx = findColumnIndex(headers, ['Category', 'category', 'Expense Category', 'Type']);
  const descIdx = findColumnIndex(headers, ['Description', 'description', 'Details', 'Notes', 'Memo']);
  const paidToIdx = findColumnIndex(headers, ['Paid To', 'paid_to', 'Vendor', 'Payee', 'Supplier']);
  const chargesIdx = findColumnIndex(headers, ['Charges (KES)', 'charges', 'Charges', 'Fee', 'Fees']);
  const ownerFundedIdx = findColumnIndex(headers, ['Owner/Related-Party Funded', 'owner_funded', 'Owner Funded', 'Personal Funds']);

  if (dateIdx === -1 || amountIdx === -1) {
    throw new Error('Could not find a header row containing "Date" and "Amount" columns. Check your file layout.');
  }

  const parsedExpenses = [];
  const skippedRows = [];

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.every(cell => String(cell).trim() === '')) continue;

    const rawDate = row[dateIdx];
    const rawAmount = row[amountIdx];

    if (!rawDate || rawAmount === '' || rawAmount === null || isNaN(Number(rawAmount))) {
      skippedRows.push({ row: i + 1, reason: 'Missing valid Date or Amount value.' });
      continue;
    }

    let formattedDate = rawDate;
    if (typeof rawDate === 'number') {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      formattedDate = new Date(excelEpoch.getTime() + rawDate * 86400000).toISOString().split('T')[0];
    } else {
      formattedDate = String(rawDate).trim();
    }

    parsedExpenses.push({
      date: formattedDate,
      txn_ref: txnRefIdx !== -1 ? String(row[txnRefIdx] || '').trim() : '',
      account_used: accountIdx !== -1 ? String(row[accountIdx] || '').trim() : 'M-Pesa Till',
      category: categoryIdx !== -1 ? String(row[categoryIdx] || '').trim() : 'Uncategorized',
      description: descIdx !== -1 ? String(row[descIdx] || '').trim() : '',
      paid_to: paidToIdx !== -1 ? String(row[paidToIdx] || '').trim() : '',
      amount_kes: Math.abs(Number(rawAmount)),
      charges_kes: chargesIdx !== -1 ? Math.abs(Number(row[chargesIdx]) || 0) : 0,
      owner_funded: ownerFundedIdx !== -1 ? String(row[ownerFundedIdx]).toLowerCase().includes('yes') || row[ownerFundedIdx] === true : false
    });
  }

  return { imported: parsedExpenses, skipped: skippedRows };
}

if (typeof window !== 'undefined') {
  window.importExpensesFromFile = importExpensesFromFile;
}