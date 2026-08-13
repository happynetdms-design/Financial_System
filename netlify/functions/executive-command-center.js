const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');

const n=v=>Number(v||0);
function monthKey(d){ return String(d||'').slice(0,7); }

exports.handler=async event=>{
  if(event.httpMethod!=='GET') return json(405,{error:'GET only'});
  const q=event.queryStringParameters||{};
  const branchId=q.branch_id;
  const ctx=await requireBranchAccess(event,requireUser,adminClient(),branchId,{write:false});
  if(ctx.error) return json(ctx.status,{error:ctx.error});
  const admin=adminClient();
  try{
    const [txR,allocR,budgetR,loanR,acctR]=await Promise.all([
      admin.from('financial_transactions').select('transaction_date,transaction_type,direction,net_amount_kes,category_id,counterparty,source_system').eq('branch_id',branchId).eq('is_deleted',false).eq('classification_status','classified').order('transaction_date',{ascending:false}).limit(10000),
      admin.from('profit_first_allocations').select('*').eq('branch_id',branchId).order('period',{ascending:false}).limit(200),
      admin.from('budgets').select('*').eq('branch_id',branchId).order('period_start',{ascending:false}).limit(100),
      admin.from('loans').select('debt_name,lender,current_balance_kes,status').eq('branch_id',branchId).eq('is_deleted',false),
      admin.from('financial_accounts').select('id,name,kind,is_active').eq('branch_id',branchId).eq('is_active',true)
    ]);
    if(txR.error) throw txR.error;
    const tx=txR.data||[], months={};
    let revenue=0, expenses=0, funding=0, repayments=0;
    for(const r of tx){
      const a=n(r.net_amount_kes), k=monthKey(r.transaction_date);
      months[k] ||= {revenue:0,expenses:0,net_cash:0};
      if(r.transaction_type==='revenue'&&r.direction==='in'){revenue+=a;months[k].revenue+=a;months[k].net_cash+=a;}
      if(r.transaction_type==='expense'&&r.direction==='out'){expenses+=a;months[k].expenses+=a;months[k].net_cash-=a;}
      if(r.transaction_type==='owner_loan_funding'&&r.direction==='in'){funding+=a;months[k].net_cash+=a;}
      if(r.transaction_type==='owner_loan_repayment'&&r.direction==='out'){repayments+=a;months[k].net_cash-=a;}
    }
    const keys=Object.keys(months).sort();
    const last=keys.slice(-3), prior=keys.slice(-6,-3);
    const avg=(ks,key)=>ks.length?ks.reduce((s,k)=>s+n(months[k]?.[key]),0)/ks.length:0;
    const avgRev=avg(last,'revenue'), avgExp=avg(last,'expenses');
    const {data:cm,error:ce}=await admin.from('cash_movements').select('account_id,direction,amount_kes').eq('branch_id',branchId).eq('is_deleted',false);
    if(ce) throw ce;
    const balances={}; for(const m of cm||[]){const a=n(m.amount_kes)*(m.direction==='outflow'?-1:1);balances[m.account_id]=(balances[m.account_id]||0)+a;}
    const accounts=(acctR.data||[]).map(a=>({...a,current_balance_kes:balances[a.id]||0}));
    const cash=accounts.reduce((s,a)=>s+n(a.current_balance_kes),0);
    const monthlyBurn=Math.max(avgExp-avgRev,0);
    const runway=monthlyBurn>0?Math.max(0,(cash/monthlyBurn)):null;
    const health=[];
    if(avgRev>0&&avgExp/avgRev>0.9) health.push({severity:'high',code:'margin_pressure',message:'Operating expenses are consuming 90% or more of recent revenue.'});
    if(runway!==null&&runway<1) health.push({severity:'critical',code:'cash_pressure',message:'Available cash is below one month of recent operating burn.'});
    if(runway!==null&&runway<3) health.push({severity:'medium',code:'cash_watch',message:'Cash runway is below three months at the recent burn rate.'});
    if(avgRev>0&&avgExp/avgRev<0.7) health.push({severity:'good',code:'healthy_margin',message:'Recent operating expenses remain below 70% of revenue.'});
    const recentRev=avg(last,'revenue'), priorRev=avg(prior,'revenue');
    const growth=priorRev?((recentRev-priorRev)/priorRev)*100:null;
    const loanBalance=(loanR.data||[]).reduce((s,l)=>s+n(l.current_balance_kes),0);
    return json(200,{as_of:new Date().toISOString(),branch_id:branchId,
      kpis:{revenue,expenses,operating_result:revenue-expenses,owner_funding:funding,owner_repayments:repayments,owner_loan_balance:loanBalance,cash_balance:cash,cash_runway_months:runway,recent_revenue_growth_pct:growth},
      monthly:keys.slice(-12).map(k=>({month:k,...months[k]})),
      health,accounts,allocations:(allocR.data||[]).slice(0,24),budgets:(budgetR.data||[]).slice(0,24)});
  }catch(e){ console.error(e); return json(500,{error:e.message||'Unable to build executive snapshot.'});}
};