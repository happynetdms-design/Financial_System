/* Extracted from app.js; load order is intentional. */
/* ---------------- Phase 3: per-resource API (revenue, expenses, loans,
   loan payments, tax, settings). /api/state is kept ONLY for the pieces
   that aren't normalized tables yet: categories, monthlyArchive,
   closedMonths. Everything money-related below goes through its own
   RBAC-checked, audited endpoint. ---------------- */

async function apiGetMe(){
  const res = await apiFetch('/api/me', { method:'GET' });
  if(!res.ok) throw new Error('Could not load your access.');
  return res.json();
}

const JSONH = { 'Content-Type':'application/json' };

async function apiList(path, branchId, extraQuery){
  const qs = new URLSearchParams(Object.assign({ branch_id: branchId }, extraQuery||{}));
  const res = await apiFetch(path + '?' + qs.toString(), { method:'GET' });
  if(!res.ok) throw new Error('Failed to load ' + path);
  return res.json();
}
async function apiCreate(path, body){
  const res = await apiFetch(path, { method:'POST', headers: JSONH, body: JSON.stringify(body) });
  if(!res.ok){ const b = await res.json().catch(()=>({})); throw new Error(b.error || ('Create failed: ' + path)); }
  return res.json();
}
async function apiUpdate(path, body){
  const res = await apiFetch(path, { method:'PATCH', headers: JSONH, body: JSON.stringify(body) });
  if(!res.ok){ const b = await res.json().catch(()=>({})); throw new Error(b.error || ('Update failed: ' + path)); }
  return res.json();
}
async function apiRemove(path, body){
  const res = await apiFetch(path, { method:'DELETE', headers: JSONH, body: JSON.stringify(body) });
  if(!res.ok){ const b = await res.json().catch(()=>({})); throw new Error(b.error || ('Delete failed: ' + path)); }
  return res.json();
}
async function apiPutSettings(body){
  const res = await apiFetch('/api/settings', { method:'PUT', headers: JSONH, body: JSON.stringify(body) });
  if(!res.ok){ const b = await res.json().catch(()=>({})); throw new Error(b.error || 'Settings update failed'); }
  return res.json();
}
