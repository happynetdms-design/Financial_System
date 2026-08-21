import { apiFetch } from './02-api-auth.js';

export const JSONH = { 'Content-Type': 'application/json' };

function assertOpenPeriod(body){
  const dates = ['date','entry_date','expense_date','payment_date','transaction_date','movement_date','period']
    .map(key => body && body[key]).filter(Boolean).map(value => String(value).slice(0, 7));
  if(typeof state === 'undefined' || !state || !Array.isArray(state.closedMonths)) return;
  const locked = dates.find(month => state.closedMonths.includes(month));
  if(locked) throw new Error(`This operation is blocked because ${locked} is a closed period.`);
}

export async function apiGetMe() {
  const res = await apiFetch('/api/me', { method: 'GET' });
  if (!res.ok) throw new Error('Could not load your access.');
  return res.json();
}

export async function apiList(path, branchId, extraQuery) {
  const qs = new URLSearchParams(Object.assign({ branch_id: branchId }, extraQuery || {}));
  const res = await apiFetch(path + '?' + qs.toString(), { method: 'GET' });
  if (!res.ok) throw new Error('Failed to load ' + path);
  return res.json();
}

export async function apiCreate(path, body) {
  assertOpenPeriod(body);
  const res = await apiFetch(path, { method: 'POST', headers: JSONH, body: JSON.stringify(body) });
  if (!res.ok) { 
    const b = await res.json().catch(() => ({})); 
    throw new Error(b.error || ('Create failed: ' + path)); 
  }
  return res.json();
}

export async function apiUpdate(path, body) {
  assertOpenPeriod(body);
  const res = await apiFetch(path, { method: 'PATCH', headers: JSONH, body: JSON.stringify(body) });
  if (!res.ok) { 
    const b = await res.json().catch(() => ({})); 
    throw new Error(b.error || ('Update failed: ' + path)); 
  }
  return res.json();
}

export async function apiRemove(path, body) {
  assertOpenPeriod(body);
  const res = await apiFetch(path, { method: 'DELETE', headers: JSONH, body: JSON.stringify(body) });
  if (!res.ok) { 
    const b = await res.json().catch(() => ({})); 
    throw new Error(b.error || ('Delete failed: ' + path)); 
  }
  return res.json();
}

export async function apiPutSettings(body) {
  const res = await apiFetch('/api/settings', { method: 'PUT', headers: JSONH, body: JSON.stringify(body) });
  if (!res.ok) { 
    const b = await res.json().catch(() => ({})); 
    throw new Error(b.error || 'Settings update failed'); 
  }
  return res.json();
}