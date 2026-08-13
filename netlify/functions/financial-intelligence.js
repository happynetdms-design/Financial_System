const {requireUser,adminClient,json}=require('./_lib/supabase');
const {requireBranchAccess}=require('./_lib/rbac');
const num=v=>Number(v||0);
exports.handler=async event=>{
 if(event.httpMethod!=='GET')return json(405,{error:'GET only'});
 const q=event.queryStringParameters||{};const branchId=q.branch_id;const ctx=await requireBranchAccess(event,requireUser,adminClient(),branchId,{write:false});if(ctx.error)return json(ctx.status,{error:ctx.error});const admin=adminClient();
 try{
  const months=Math.max(3,Math.min(12,Number(q.months||6)));const since=new Date();since.setMonth(since.getMonth()-months);const cutoff=since.toISOString().slice(0,10);
  const {data,error}=await admin.from('financial_transactions').select('transaction_date,transaction_type,direction,net_amount_kes,category_id,counterparty,description').eq('branch_id',branchId).eq('is_deleted',false).eq('classification_status','classified').gte('transaction_date',cutoff).order('transaction_date');if(error)throw new Error(error.message);
  const byMonth={};const byCategory={};for(const r of data||[]){const a=num(r.net_amount_kes);const m=r.transaction_date.slice(0,7);byMonth[m]??={revenue:0,expenses:0};if(r.transaction_type==='revenue')byMonth[m].revenue+=a;if(r.transaction_type==='expense'){byMonth[m].expenses+=a;const k=r.category_id||'uncategorized';byCategory[k]=(byCategory[k]||0)+a;}}
  const series=Object.keys(byMonth).sort().map(m=>({month:m,...byMonth[m],net:byMonth[m].revenue-byMonth[m].expenses}));
  const rev=series.map(x=>x.revenue),exp=series.map(x=>x.expenses);const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
  const recent=series.slice(-3);const avgRev=avg(recent.map(x=>x.revenue));const avgExp=avg(recent.map(x=>x.expenses));const growth=series.length>=2&&series[series.length-2].revenue>0?((series[series.length-1].revenue-series[series.length-2].revenue)/series[series.length-2].revenue)*100:0;
  const alerts=[];if(growth<-10)alerts.push({type:'revenue_decline',severity:'warning',message:`Latest monthly revenue is down ${Math.abs(growth).toFixed(1)}% versus the prior month.`});if(avgExp>avgRev)alerts.push({type:'cash_pressure',severity:'critical',message:'Average expenses over the latest three months exceed average revenue.'});
  return json(200,{forecast:{next_month_revenue_kes:avgRev,next_month_expenses_kes:avgExp,next_month_operating_result_kes:avgRev-avgExp,method:'3-month moving average',is_prediction:true},trend:{monthly:series,recent_revenue_growth_pct:growth},expense_concentration:byCategory,alerts});
 }catch(e){return json(500,{error:e.message});}
};
