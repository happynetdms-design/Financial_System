const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');
const n=v=>Number(v||0);
exports.handler=async event=>{
 if(event.httpMethod!=='POST')return json(405,{error:'POST only'});
 let b={};try{b=JSON.parse(event.body||'{}')}catch{return json(400,{error:'Invalid JSON'})}
 const branchId=b.branch_id, revenueChange=n(b.revenue_change_pct), expenseChange=n(b.expense_change_pct), months=Math.max(1,Math.min(24,Number(b.months||6)));
 const ctx=await requireBranchAccess(event,requireUser,adminClient(),branchId,{write:false});if(ctx.error)return json(ctx.status,{error:ctx.error});
 const admin=adminClient();
 try{
  const {data,error}=await admin.from('financial_transactions').select('transaction_date,transaction_type,direction,net_amount_kes').eq('branch_id',branchId).eq('is_deleted',false).eq('classification_status','classified').limit(10000);
  if(error)throw error;
  const rows=data||[], by={};
  for(const r of rows){const k=String(r.transaction_date||'').slice(0,7);by[k] ||= {r:0,e:0};
   if(r.transaction_type==='revenue'&&r.direction==='in')by[k].r+=n(r.net_amount_kes);
   if(r.transaction_type==='expense'&&r.direction==='out')by[k].e+=n(r.net_amount_kes);
  }
  const ks=Object.keys(by).sort().slice(-3); const avg=(k)=>ks.length?ks.reduce((s,x)=>s+by[x][k],0)/ks.length:0;
  const baseR=avg('r'),baseE=avg('e'), r=baseR*(1+revenueChange/100), e=baseE*(1+expenseChange/100), monthly=r-e;
  const result={assumptions:{base_monthly_revenue:baseR,base_monthly_expenses:baseE,revenue_change_pct:revenueChange,expense_change_pct:expenseChange,months},monthly_revenue:r,monthly_expenses:e,monthly_operating_result:monthly,period_operating_result:monthly*months};
  return json(200,{result,classification:'FORECAST',note:'Scenario only. It does not post transactions, alter allocations, or change the ledger.'});
 }catch(e){return json(500,{error:e.message||'Scenario failed'});}
};