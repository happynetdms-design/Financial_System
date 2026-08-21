/* Shared tolerant spreadsheet parser for CSV, XLSX, and XLS imports. */
(function(){
  const patterns = {
    date: [/date/i, /time/i, /trans.*date/i, /created/i, /completion/i],
    txn_ref: [/txn.*ref/i, /reference/i, /receipt/i, /trans.*id/i, /ref/i, /receipt.*no/i],
    account_used: [/account/i, /channel/i, /source/i, /pay.*method/i, /wallet/i],
    category: [/categor/i, /type/i, /classification/i],
    description: [/desc/i, /detail/i, /particulars/i, /note/i, /reason/i, /narration/i],
    paid_to: [/paid ?to/i, /vendor/i, /payee/i, /recipient/i, /customer/i, /name/i, /receiver/i],
    amount_kes: [/amount/i, /value/i, /kes/i, /paid/i, /debit/i, /credit/i, /total/i, /withdrawn/i],
    charges_kes: [/charge/i, /fee/i, /tariff/i, /cost/i],
    owner_funded: [/owner.*funded/i, /related.?party/i, /personal/i],
    status: [/status/i, /transaction status/i],
    service: [/service/i, /direction/i, /flow/i],
    remark: [/remark/i, /message/i, /narration/i],
    details: [/detail/i, /particular/i],
    incoming: [/paid in/i, /credit/i, /deposit/i],
    outgoing: [/withdrawn/i, /debit/i, /withdrawal/i]
  };

  function cleanHeader(value){
    return String(value ?? '').replace(/\uFEFF/g, '').replace(/["']/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
  }
  function cleanValue(value){
    return typeof value === 'string' ? value.replace(/\uFEFF/g, '').trim() : value;
  }
  function numberValue(value){
    if(value === null || value === undefined || value === '') return null;
    const cleaned = String(value).replace(/[^0-9.\-]/g, '');
    if(!cleaned || cleaned === '-' || cleaned === '.') return null;
    const number = Number(cleaned);
    return Number.isFinite(number) ? number : null;
  }
  function dateValue(value){
    if(value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    if(typeof value === 'number' && window.XLSX?.SSF){
      const date = window.XLSX.SSF.parse_date_code(value);
      if(date) return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
    const text = String(value ?? '').trim();
    if(!text) return null;
    const iso = text.match(/(\d{4})[-/]?(\d{2})[-/]?(\d{2})/);
    if(iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const dmy = text.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if(dmy) return `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  }
  function matches(header, key){ return (patterns[key] || []).some(pattern => pattern.test(header)); }
  function detectHeaders(grid){
    let best = null;
    for(let rowIndex = 0; rowIndex < Math.min(grid.length, 50); rowIndex++){
      const row = grid[rowIndex] || [];
      const headers = row.map(cleanHeader);
      const score = Object.keys(patterns).filter(key => headers.some(header => header && matches(header, key))).length;
      const hasDate = headers.some(header => matches(header, 'date'));
      const hasAmount = headers.some(header => matches(header, 'amount'));
      if(hasDate && hasAmount && (!best || score > best.score)) best = { rowIndex, headers, score };
    }
    if(!best) throw new Error('Could not find a header row with date and amount columns.');
    const map = {};
    best.headers.forEach((header, index) => {
      if(!header) return;
      Object.keys(patterns).forEach(key => { if(map[key] === undefined && matches(header, key)) map[key] = index; });
    });
    return { ...best, map };
  }
  function sourceKind(file, type, headers){
    const hint = `${file.name} ${type || ''} ${headers.join(' ')}`.toLowerCase();
    if(/utility|receipt no|organization settlement/.test(hint)) return 'organization_utility';
    if(/tende|service|date initiated/.test(hint)) return 'tende';
    return type || 'expense';
  }
  window.parseFinancialExport = async function(file, type = 'expense'){
    if(!window.XLSX) throw new Error('Spreadsheet reader is unavailable. Reload the page and try again.');
    const workbook = window.XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    if(!workbook.SheetNames.length) throw new Error('The spreadsheet contains no worksheets.');
    const sheetName = workbook.SheetNames.find(name => /expense|revenue|loan|tende|utility|data|sheet/i.test(name)) || workbook.SheetNames[0];
    const grid = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: null, blankrows: false });
    const header = detectHeaders(grid);
    const source = sourceKind(file, type, header.headers);
    const rows = [];
    const skipped = [];
    for(let rowIndex = header.rowIndex + 1; rowIndex < grid.length; rowIndex++){
      const row = grid[rowIndex] || [];
      if(row.every(value => value === null || String(value).trim() === '')) continue;
      const value = key => header.map[key] === undefined ? null : cleanValue(row[header.map[key]]);
      const date = dateValue(value('date'));
      const amountCandidates = [value('amount_kes'), value('incoming'), value('outgoing')]
        .map(numberValue).filter(number => number !== null);
      const amount = amountCandidates.find(number => number !== 0) ?? amountCandidates[0] ?? null;
      if(!date || amount === null){ skipped.push({ row: rowIndex + 1, reason: !date ? 'invalid date' : 'invalid amount' }); continue; }
      const generatedRef = `IMP-${date.replace(/-/g, '')}-${String(rowIndex + 1).padStart(4, '0')}`;
      const reference = String(value('txn_ref') || '').trim() || generatedRef;
      const service = String(value('service') || '').trim();
      const status = String(value('status') || '').trim();
      rows.push({
        row_number: rowIndex + 1, source_ref: reference, ref: reference, receipt_no: reference,
        date, date_initiated: date, completion_time: date,
        amount, amount_kes: amount,
        charge: numberValue(value('charges_kes')) || 0, charges_kes: numberValue(value('charges_kes')) || 0,
        account_used: String(value('account_used') || '').trim(), category: String(value('category') || '').trim(),
        description: String(value('description') || value('details') || value('remark') || '').trim(),
        details: String(value('details') || value('description') || '').trim(),
        paid_to: String(value('paid_to') || '').trim(), receiver: String(value('paid_to') || '').trim(),
        name: String(value('paid_to') || '').trim(), remark: String(value('remark') || value('description') || '').trim(),
        owner_funded: /^(y|yes|true|1)$/i.test(String(value('owner_funded') || '')),
        service, status, transaction_status: status, raw_row: row
      });
    }
    return { source, headers: header.headers, headerRow: header.rowIndex + 1, rows, skipped };
  };
  window.parseFinancialValue = numberValue;
})();
