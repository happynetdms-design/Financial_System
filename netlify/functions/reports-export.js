const { requireUser, adminClient, json } = require('./_lib/supabase');
const { requireBranchAccess } = require('./_lib/rbac');
const esc = v => String(v ?? '').replace(/"/g,'""');
const num = v => Number(v || 0);
function csv(rows){ return rows.map(r=>r.map(x=>`"${esc(x)}"`).join(',')).join('\n'); }
function pdfText(lines){
  const safe=lines.map(x=>String(x).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)'));
  let y=790; let content='BT /F1 10 Tf 40 '+y+' Td ';
  for(let i=0;i<safe.length;i++){ if(i) content+='0 -14 Td '; content+='('+safe[i]+') Tj '; }
  content+='ET';
  const objs=[]; objs[1]='<< /Type /Catalog /Pages 2 0 R >>'; objs[2]='<< /Type /Pages /Kids [3 0 R] /Count 1 >>'; objs[3]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>'; objs[4]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'; objs[5]=`<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  let out='%PDF-1.4\n', offsets=[0]; for(let i=1;i<objs.length;i++){offsets[i]=out.length;out+=`${i} 0 obj\n${objs[i]}\nendobj\n`;}
  const xref=out.length;out+=`xref\n0 ${objs.length}\n0000000000 65535 f \n`;for(let i=1;i<objs.length;i++)out+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';out+=`trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out,'binary').toString('base64');
}
exports.handler=async event=>{
 if(event.httpMethod!=='GET')return json(405,{error:'GET only'});
 const q=event.queryStringParameters||{}, branchId=q.branch_id, format=(q.format||'csv').toLowerCase();
 const ctx=await requireBranchAccess(event,requireUser,adminClient(),branchId,{write:false}); if(ctx.error)return json(ctx.status,{error:ctx.error});
 const admin=adminClient(), from=q.from||`${new Date().getUTCFullYear()}-01-01`, to=q.to||new Date().toISOString().slice(0,10);
 try{
  const {data,error}=await admin.from('financial_transactions').select('transaction_date,transaction_type,direction,net_amount_kes,counterparty,description,source_system,source_ref').eq('branch_id',branchId).eq('is_deleted',false).eq('classification_status','classified').gte('transaction_date',from).lte('transaction_date',to).order('transaction_date');if(error)throw new Error(error.message);
  const rows=data||[]; const header=['Date','Type','Direction','Amount KES','Counterparty','Description','Source','Reference'];
  const body=rows.map(r=>[r.transaction_date,r.transaction_type,r.direction,num(r.net_amount_kes).toFixed(2),r.counterparty||'',r.description||'',r.source_system||'',r.source_ref||'']);
  if(format==='csv') return {statusCode:200,headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="happynet-financial-report-${from}-to-${to}.csv"`},body:csv([header,...body])};
  if(format==='xls'){ const html='<html><head><meta charset="utf-8"></head><body><table border="1"><tr>'+header.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr>'+body.map(r=>'<tr>'+r.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</table></body></html>'; return {statusCode:200,headers:{'Content-Type':'application/vnd.ms-excel','Content-Disposition':`attachment; filename="happynet-financial-report-${from}-to-${to}.xls"`},body:html}; }
  if(format==='pdf'){ const totals=rows.reduce((a,r)=>{const x=num(r.net_amount_kes);if(r.transaction_type==='revenue')a.revenue+=x;if(r.transaction_type==='expense')a.expenses+=x;return a},{revenue:0,expenses:0}); const lines=['HAPPYNET FINANCIAL MANAGEMENT REPORT',`Period: ${from} to ${to}`,`Revenue: KES ${totals.revenue.toLocaleString()}`,`Expenses: KES ${totals.expenses.toLocaleString()}`,`Net operating result: KES ${(totals.revenue-totals.expenses).toLocaleString()}`,`Transactions: ${rows.length}`,'','Date | Type | Amount | Counterparty']; body.slice(0,45).forEach(r=>lines.push(`${r[0]} | ${r[1]} | ${r[3]} | ${r[4]}`)); return {statusCode:200,isBase64Encoded:true,headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="happynet-financial-report-${from}-to-${to}.pdf"`},body:pdfText(lines)}; }
  return json(400,{error:'format must be csv or pdf'});
 }catch(e){return json(500,{error:e.message});}
};
