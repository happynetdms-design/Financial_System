const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');
const n=v=>Number(v||0);
exports.handler=async event=>{
  if(event.httpMethod!=='GET') return json(405,{error:'GET only'});
  const q=event.queryStringParameters||{};
  const branchId=q.branch_id, from=q.from, to=q.to;
  if(!branchId||!from||!to) return json(400,{error:'branch_id, from and to are required'});
  const ctx=await requireBranchAccess(event,requireUser,adminClient(),branchId,{write:false});
  if(ctx.error) return json(ctx.status,{error:ctx.error});
  const db=adminClient();
  try {
    const [{data:coa,error:ce},{data:jl,error:je},{data:ft,error:fe}] = await Promise.all([
      db.from('chart_of_accounts').select('id,code,name,account_type').eq('branch_id',branchId).eq('is_active',true).order('code'),
      db.from('journal_lines').select('account_id,debit_kes,credit_kes,journal_entry:journal_entries!inner(branch_id,entry_date,status)').eq('journal_entry.branch_id',branchId).eq('journal_entry.status','posted').gte('journal_entry.entry_date',from).lte('journal_entry.entry_date',to),
      db.from('financial_transactions').select('transaction_date,transaction_type,direction,net_amount_kes,description,counterparty').eq('branch_id',branchId).eq('is_deleted',false).eq('classification_status','classified').gte('transaction_date',from).lte('transaction_date',to)
    ]);
    if(ce||je||fe) throw (ce||je||fe);
    const accounts=coa||[]; const lines=jl||[]; const tx=ft||[];
    const by={}; accounts.forEach(a=>by[a.id]={...a,debit:0,credit:0,balance:0});
    lines.forEach(l=>{if(!by[l.account_id])return;by[l.account_id].debit+=n(l.debit_kes);by[l.account_id].credit+=n(l.credit_kes);by[l.account_id].balance+=n(l.debit_kes)-n(l.credit_kes);});
    const rows=Object.values(by);
    const pnlRows=rows.filter(r=>['revenue','expense'].includes(r.account_type));
    const revenue=pnlRows.filter(r=>r.account_type==='revenue').reduce((s,r)=>s-r.balance,0);
    const expenses=pnlRows.filter(r=>r.account_type==='expense').reduce((s,r)=>s+r.balance,0);
    const netProfit=revenue-expenses;
    const assets=rows.filter(r=>r.account_type==='asset').map(r=>({...r,balance: r.balance}));
    const liabilities=rows.filter(r=>r.account_type==='liability').map(r=>({...r,balance:-r.balance}));
    const equity=rows.filter(r=>r.account_type==='equity').map(r=>({...r,balance:-r.balance}));
    const totalAssets=assets.reduce((s,r)=>s+r.balance,0);
    const totalLiabilities=liabilities.reduce((s,r)=>s+r.balance,0);
    const totalEquity=equity.reduce((s,r)=>s+r.balance,0)+netProfit;
    const cashIn=tx.filter(r=>r.direction==='in').reduce((s,r)=>s+n(r.net_amount_kes),0);
    const cashOut=tx.filter(r=>r.direction==='out').reduce((s,r)=>s+n(r.net_amount_kes),0);
    const ownerFunding=tx.filter(r=>r.transaction_type==='owner_loan_funding'&&r.direction==='in').reduce((s,r)=>s+n(r.net_amount_kes),0);
    const ownerRepayments=tx.filter(r=>r.transaction_type==='owner_loan_repayment'&&r.direction==='out').reduce((s,r)=>s+n(r.net_amount_kes),0);
    const operatingIn=tx.filter(r=>r.direction==='in'&&!['owner_loan_funding'].includes(r.transaction_type)).reduce((s,r)=>s+n(r.net_amount_kes),0);
    const operatingOut=tx.filter(r=>r.direction==='out'&&!['owner_loan_repayment'].includes(r.transaction_type)).reduce((s,r)=>s+n(r.net_amount_kes),0);
    return json(200,{period:{from,to},profit_and_loss:{revenue,expenses,net_profit:netProfit},balance_sheet:{assets,total_assets:totalAssets,liabilities,total_liabilities:totalLiabilities,equity,total_equity:totalEquity,balanced:Math.abs(totalAssets-(totalLiabilities+totalEquity))<0.01},cash_flow:{operating_in:operatingIn,operating_out:operatingOut,net_operating_cash:operatingIn-operatingOut,owner_funding:ownerFunding,owner_repayments:ownerRepayments,net_financing_cash:ownerFunding-ownerRepayments,net_cash_movement:cashIn-cashOut},transaction_count:tx.length,journal_line_count:lines.length});
  } catch(e){ return json(500,{error:e.message}); }
};
