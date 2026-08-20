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

/* ---------------- .xlsx export (Phase 5) â€” uses the SheetJS build already
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
    ${loading ? '<span class="hint">Workingâ€¦</span>' :
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
