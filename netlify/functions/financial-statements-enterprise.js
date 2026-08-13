const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');
const n=v=>Number(v||0);
const money=v=>Math.round(n(v)*100)/100;
function sum(rows,fn){return money((rows||[]).reduce((s,r)=>s+n(fn(r)),0));}
function classifyBalance(a,net){
  if(a.account_type==='asset') return n(a.debit)-n(a.credit);
  if(['liability','equity'].includes(a.account_type)) return n(a.credit)-n(a.debit);
  if(a.account_type==='revenue') return -(n(a.debit)-n(a.credit));
  if(a.account_type==='expense') return n(a.debit)-n(a.credit);
  return 0;
}
function periodDates(from,to){return {from,to,days:Math.max(1,Math.round((new Date(to)-new Date(from))/86400000)+1)};}
exports.handler=async event=>{
 if(event.httpMethod!=='GET') return json(405,{error:'GET only'});
 const q=event.queryStringParameters||{}; const branchId=q.branch_id,from=q.from,to=q.to;
 if(!branchId||!from||!to) return json(400,{error:'branch_id, from and to are required'});
 const ctx=await requireBranchAccess(event,requireUser,adminClient(),branchId,{write:false}); if(ctx.error)return json(ctx.status,{error:ctx.error});
 const db=adminClient();
 try{
  const prevFrom=q.prev_from||(()=>{const d=new Date(from+'T00:00:00Z');d.setUTCFullYear(d.getUTCFullYear()-1);return d.toISOString().slice(0,10)})();
  const prevTo=q.prev_to||(()=>{const d=new Date(to+'T00:00:00Z');d.setUTCFullYear(d.getUTCFullYear()-1);return d.toISOString().slice(0,10)})();
  const asOf=to;
  const [{data:coa,error:ce},{data:lines,error:le},{data:allLines,error:ae},{data:tx,error:te},{data:noop,error:ne}]=await Promise.all([
   db.from('chart_of_accounts').select('id,code,name,account_type,is_control,is_active,cash_flow_category').eq('branch_id',branchId).eq('is_active',true).order('code'),
   db.from('journal_lines').select('account_id,debit_kes,credit_kes,journal_entry:journal_entries!inner(id,branch_id,entry_date,status,reference,description)').eq('journal_entry.branch_id',branchId).eq('journal_entry.status','posted').gte('journal_entry.entry_date',from).lte('journal_entry.entry_date',to),
   db.from('journal_lines').select('account_id,debit_kes,credit_kes,journal_entry:journal_entries!inner(id,branch_id,entry_date,status,reference,description)').eq('journal_entry.branch_id',branchId).eq('journal_entry.status','posted').lte('journal_entry.entry_date',asOf),
   db.from('financial_transactions').select('transaction_date,transaction_type,direction,net_amount_kes,description,counterparty,source_ref').eq('branch_id',branchId).eq('is_deleted',false).eq('classification_status','classified').gte('transaction_date',from).lte('transaction_date',to)
  ]);
  if(ce||le||ae||te||ne) throw (ce||le||ae||te||ne);
  const accounts=coa||[]; const by={}; accounts.forEach(a=>by[a.id]={...a,debit:0,credit:0,balance:0});
  (allLines||[]).forEach(l=>{if(!by[l.account_id])return;by[l.account_id].debit+=n(l.debit_kes);by[l.account_id].credit+=n(l.credit_kes);});
  Object.values(by).forEach(a=>a.balance=classifyBalance(a));
  const pmap={}; accounts.forEach(a=>pmap[a.id]=a);
  const currentBy={}; accounts.forEach(a=>currentBy[a.id]={...a,debit:0,credit:0,balance:0});
  (lines||[]).forEach(l=>{if(!currentBy[l.account_id])return;currentBy[l.account_id].debit+=n(l.debit_kes);currentBy[l.account_id].credit+=n(l.credit_kes);});
  Object.values(currentBy).forEach(a=>a.balance=classifyBalance(a));
  const pnl=Object.values(currentBy).filter(a=>['revenue','expense'].includes(a.account_type));
  const revenueRows=pnl.filter(a=>a.account_type==='revenue').map(a=>({code:a.code,name:a.name,amount:money(a.balance)}));
  const expenseRows=pnl.filter(a=>a.account_type==='expense').map(a=>({code:a.code,name:a.name,amount:money(a.balance)}));
  const revenue=sum(revenueRows,r=>r.amount), expenses=sum(expenseRows,r=>r.amount), netProfit=money(revenue-expenses);
  const assets=Object.values(by).filter(a=>a.account_type==='asset').map(a=>({code:a.code,name:a.name,amount:money(a.balance)}));
  const liabilities=Object.values(by).filter(a=>a.account_type==='liability').map(a=>({code:a.code,name:a.name,amount:money(a.balance)}));
  const equityBase=Object.values(by).filter(a=>a.account_type==='equity').map(a=>({code:a.code,name:a.name,amount:money(a.balance)}));
  const cumulativeRevenue=sum(Object.values(by).filter(a=>a.account_type==='revenue'),a=>a.balance);
  const cumulativeExpenses=sum(Object.values(by).filter(a=>a.account_type==='expense'),a=>a.balance);
  const currentEarnings=money(cumulativeRevenue-cumulativeExpenses);
  const equity=equityBase.concat([{code:'CURRENT-EARNINGS',name:'Current / Retained Earnings',amount:currentEarnings}]);
  const totalAssets=sum(assets,r=>r.amount), totalLiabilities=sum(liabilities,r=>r.amount), totalEquity=sum(equity,r=>r.amount);
  const cashAccounts=Object.values(by).filter(a=>a.account_type==='asset'&&(a.code==='1000'||a.code==='1100'||/cash|bank|m-?pesa|mobile/i.test(a.name))).map(a=>({code:a.code,name:a.name,amount:money(a.balance)}));
  const cashBalance=sum(cashAccounts,r=>r.amount);
  const txs=tx||[];
  const cashIn=sum(txs.filter(r=>r.direction==='in'),r=>r.net_amount_kes),cashOut=sum(txs.filter(r=>r.direction==='out'),r=>r.net_amount_kes);
  const ownerFunding=sum(txs.filter(r=>r.direction==='in'&&r.transaction_type==='owner_loan_funding'),r=>r.net_amount_kes);
  const ownerRepayment=sum(txs.filter(r=>r.direction==='out'&&r.transaction_type==='owner_loan_repayment'),r=>r.net_amount_kes);
  const operatingIn=sum(txs.filter(r=>r.direction==='in'&&r.transaction_type!=='owner_loan_funding'),r=>r.net_amount_kes);
  const operatingOut=sum(txs.filter(r=>r.direction==='out'&&r.transaction_type!=='owner_loan_repayment'),r=>r.net_amount_kes);
  const cf={operating_in:operatingIn,operating_out:operatingOut,net_operating:money(operatingIn-operatingOut),financing_in:ownerFunding,financing_out:ownerRepayment,net_financing:money(ownerFunding-ownerRepayment),net_movement:money(cashIn-cashOut),closing_cash:cashBalance};
  const current={revenue,expenses,netProfit};
  const prevLines=(await db.from('journal_lines').select('account_id,debit_kes,credit_kes,journal_entry:journal_entries!inner(branch_id,entry_date,status)').eq('journal_entry.branch_id',branchId).eq('journal_entry.status','posted').gte('journal_entry.entry_date',prevFrom).lte('journal_entry.entry_date',prevTo)).data||[];
  const prevAccounts={}; accounts.forEach(a=>prevAccounts[a.id]={...a,debit:0,credit:0,balance:0}); prevLines.forEach(l=>{if(prevAccounts[l.account_id]){prevAccounts[l.account_id].debit+=n(l.debit_kes);prevAccounts[l.account_id].credit+=n(l.credit_kes);}});Object.values(prevAccounts).forEach(a=>a.balance=classifyBalance(a));
  const prevRevenue=sum(Object.values(prevAccounts).filter(a=>a.account_type==='revenue'),a=>a.balance),prevExpenses=sum(Object.values(prevAccounts).filter(a=>a.account_type==='expense'),a=>a.balance),prevProfit=money(prevRevenue-prevExpenses);
  const variance={revenue:money(revenue-prevRevenue),expenses:money(expenses-prevExpenses),net_profit:money(netProfit-prevProfit),revenue_pct:prevRevenue?money((revenue-prevRevenue)/prevRevenue*100):null,expenses_pct:prevExpenses?money((expenses-prevExpenses)/prevExpenses*100):null,net_profit_pct:prevProfit?money((netProfit-prevProfit)/Math.abs(prevProfit)*100):null};
  const apBalance=sum(liabilities.filter(r=>r.code==='2000'),r=>r.amount);
  const ownerLoanBalance=sum(liabilities.filter(r=>r.code==='2200'),r=>r.amount);
  const openingEquity=money(totalEquity-netProfit);
  const equityStatement={opening_equity:money(openingEquity),current_period_profit:netProfit,closing_equity:money(totalEquity),owner_loan_excluded_from_equity:true};
  const glRows=(lines||[]).map(l=>({date:l.journal_entry?.entry_date,reference:l.journal_entry?.reference||'',description:l.journal_entry?.description||'',account:by[l.account_id]?by[l.account_id].code+' — '+by[l.account_id].name:l.account_id,debit:money(l.debit_kes),credit:money(l.credit_kes)}));
  return json(200,{period:periodDates(from,to),comparative:{period:periodDates(prevFrom,prevTo),current,previous:{revenue:prevRevenue,expenses:prevExpenses,netProfit:prevProfit},variance},profit_and_loss:{revenue_rows:revenueRows,expense_rows:expenseRows,total_revenue:revenue,total_expenses:expenses,net_profit:netProfit},balance_sheet:{as_of:asOf,assets,total_assets:totalAssets,liabilities,total_liabilities:totalLiabilities,equity,total_equity:totalEquity,balanced:Math.abs(totalAssets-(totalLiabilities+totalEquity))<0.01,difference:money(totalAssets-totalLiabilities-totalEquity)},cash_flow:cf,cash_accounts:cashAccounts,owner_loan:{balance:ownerLoanBalance,funding:ownerFunding,repayments:ownerRepayment},accounts_payable:{balance:apBalance},equity_statement:equityStatement,general_ledger:glRows,accounting:{trial_balance_debits:sum(Object.values(by),a=>a.debit),trial_balance_credits:sum(Object.values(by),a=>a.credit),trial_balance_balanced:Math.abs(sum(Object.values(by),a=>a.debit)-sum(Object.values(by),a=>a.credit))<0.01},transaction_count:txs.length});
 }catch(e){return json(500,{error:e.message});}
};
