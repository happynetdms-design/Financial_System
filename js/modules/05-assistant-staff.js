/* Extracted from app.js; load order is intentional. */
/* ---------------- AI Assistant (Phase 6) ---------------- */
// Every answer is generated server-side from a fresh pull of this branch's
// actual data (see netlify/functions/ai-assistant.js) â€” nothing here sends
// raw financial records to the model from the browser, only the question
// and a short rolling history for follow-up context.
let assistantMessages = []; // {role:'user'|'assistant', content, classification, citations}
let assistantConversationId = null;
let assistantLoading = false;
let assistantError = null;

function viewAssistant(){
  const quick=[
    ['Daily CFO Brief','Give me today\'s financial position, risks and priorities.'],
    ['Profit First Review','Review our Profit First discipline and tell me what needs attention.'],
    ['Cash Outlook','Analyze cash position, cash runway and near-term risks.'],
    ['Expense Analysis','Explain the biggest expense movements and where management should focus.'],
    ['Management Report','Prepare a management-ready financial report for the current period.'],
    ['John Loan','Give me a complete owner-loan position and explain the movement.']
  ];
  return `
    <div class="topbar"><div><h1>HFMS CFO</h1><div class="sub">Interactive finance manager for Happynet â€” analyzes, communicates, advises, prepares reports and proposes controlled actions using the live financial system.</div></div></div>
    <div class="grid-3" style="margin-bottom:16px;">
      <div class="stat"><div class="stat-label">Source of truth</div><div class="stat-value">Financial Ledger</div><div class="hint">AI never replaces accounting records.</div></div>
      <div class="stat"><div class="stat-label">AI control</div><div class="stat-value">Approval-aware</div><div class="hint">Financial mutations require confirmation and RBAC.</div></div>
      <div class="stat"><div class="stat-label">Profit First</div><div class="stat-value">Always active</div><div class="hint">Allocated cash is treated as reserved discipline.</div></div>
    </div>
    <div class="card" style="max-width:980px;">
      <div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px;">
        ${quick.map(([label,q])=>`<button class="btn ghost sm" data-cfo-quick="${q.replace(/"/g,'&quot;')}">${label}</button>`).join('')}
      </div>
      <div id="assistant-thread" style="display:flex; flex-direction:column; gap:12px; min-height:180px; max-height:55vh; overflow:auto; margin-bottom:14px;">
        ${assistantMessages.length===0 ? `<div class="narrative"><b>HFMS CFO is ready.</b><br>Ask a question, request a report, investigate a risk, run a scenario, review Profit First, or ask what management should focus on today.</div>` : ''}
        ${assistantMessages.map(m => `
          <div style="align-self:${m.role==='user'?'flex-end':'flex-start'}; max-width:90%;">
            <div style="font-size:11px; color:var(--muted); margin-bottom:2px; text-transform:uppercase; letter-spacing:.04em;">${m.role==='user'?'You':'HFMS CFO'}${m.classification?` Â· ${m.classification}`:''}</div>
            <div style="white-space:pre-wrap; background:${m.role==='user'?'var(--gold-soft,#f4ecd8)':'#f4f4f2'}; border-radius:10px; padding:11px 14px; font-size:14px; line-height:1.55;">${String(m.content||'').replace(/</g,'&lt;')}</div>
            ${m.citations?.length?`<div class="hint" style="margin-top:5px;">Evidence: ${m.citations.map(c=>`${String(c.source||'HFMS').replace(/</g,'&lt;')} â€” ${String(c.detail||'').replace(/</g,'&lt;')}`).join(' Â· ')}</div>`:''}${m.action?`<div style="margin-top:8px;"><button class="btn gold sm" data-cfo-confirm="${m.action.id}">Confirm action</button> <button class="btn ghost sm" data-cfo-cancel="${m.action.id}">Cancel</button></div>`:''}
          </div>`).join('')}
        ${assistantLoading ? `<div class="hint">HFMS CFO is analyzing the live financial contextâ€¦</div>` : ''}
        ${assistantError ? `<div class="hint" style="color:#c0392b;">${assistantError}</div>` : ''}
      </div>
      <form id="form-assistant" style="display:flex; gap:8px;">
        <input type="text" name="question" placeholder="Ask HFMS CFO about revenue, expenses, Profit First, cash, Johnâ€™s loan, budgets, tax, reports or risksâ€¦" style="flex:1;" ${assistantLoading?'disabled':''} required>
        <button class="btn gold" type="submit" ${assistantLoading?'disabled':''}>Ask CFO</button>
      </form>
      ${assistantConversationId?`<div class="hint" style="margin-top:8px;">Conversation saved in HFMS Â· ${assistantConversationId.slice(0,8)}â€¦</div>`:''}
    </div>`;
}
async function askAssistant(question){
  assistantMessages.push({ role:'user', content: question });
  assistantLoading = true; assistantError = null; render();
  try{
    const res = await apiFetch('/api/ai-cfo', {
      method:'POST', headers: JSONH,
      body: JSON.stringify({ branch_id: state.branchId, question, conversation_id: assistantConversationId, history: assistantMessages.slice(-13,-1) })
    });
    const body = await res.json();
    if(!res.ok) throw new Error(body.error || 'HFMS CFO could not answer that.');
    assistantConversationId = body.conversation_id || assistantConversationId;
    assistantMessages.push({ role:'assistant', content: body.answer, classification: body.classification, citations: body.citations || [] });
    if(body.proposed_action){
      assistantMessages.push({ role:'assistant', content:`CONTROLLED ACTION PROPOSED\n${body.proposed_action.confirmation_text || 'Confirmation required.'}\n\nRisk: ${(body.proposed_action.risk_level||'medium').toUpperCase()}\nAction: ${body.proposed_action.action_type}`, classification:'RECOMMENDATION', citations:[] , action:body.proposed_action});
    }
  }catch(e){ assistantError = e.message; }
  assistantLoading = false; render();
  const thread = document.getElementById('assistant-thread');
  if(thread) thread.scrollTop = thread.scrollHeight;
}
/* ---------------- Staff & Access (Phase 3 completion) ---------------- */
const ROLE_OPTIONS = ['owner','finance_manager','accountant','branch_manager','auditor','viewer'];
let staffState = { branches:null, grants:null, loading:false, error:null, formError:null };

async function loadStaffData(){
  staffState.loading = true; staffState.error = null; render();
  try{
    const [branchesRes, staffRes] = await Promise.all([
      apiFetch('/api/branches', { method:'GET' }).then(r=>r.json()),
      apiFetch('/api/staff', { method:'GET' }).then(r=>r.json())
    ]);
    staffState.branches = branchesRes.branches || [];
    staffState.grants = staffRes.grants || [];
  }catch(e){
    staffState.error = e.message;
  }
  staffState.loading = false;
  render();
}
async function createBranch(name, code){
  staffState.formError = null;
  try{
    const res = await apiFetch('/api/branches', { method:'POST', headers: JSONH, body: JSON.stringify({ name, code }) });
    const body = await res.json();
    if(!res.ok) throw new Error(body.error || 'Could not create that branch.');
    await loadStaffData();
    await loadState(state.branchId); // refresh state.allBranches so the switcher picks it up
    render();
  }catch(e){
    staffState.formError = e.message; render();
  }
}
async function grantAccess(email, branchId, role){
  staffState.formError = null;
  try{
    const res = await apiFetch('/api/staff', { method:'POST', headers: JSONH, body: JSON.stringify({ email, branch_id: branchId, role }) });
    const body = await res.json();
    if(!res.ok) throw new Error(body.error || 'Could not grant access.');
    await loadStaffData();
  }catch(e){
    staffState.formError = e.message; render();
  }
}
async function revokeAccess(userId, branchId){
  if(!confirm('Revoke this person\'s access to this branch?')) return;
  try{
    const res = await apiFetch('/api/staff', { method:'DELETE', headers: JSONH, body: JSON.stringify({ user_id: userId, branch_id: branchId }) });
    const body = await res.json();
    if(!res.ok) throw new Error(body.error || 'Could not revoke access.');
    await loadStaffData();
  }catch(e){
    staffState.error = e.message; render();
  }
}

function viewStaff(){
  const { branches, grants, loading, error, formError } = staffState;
  return `
    <div class="topbar"><div><h1>Staff &amp; Access</h1><div class="sub">Visible to Head Office only â€” controls who can see which branch, and at what role.</div></div></div>

    <div class="section-head"><h2>Branches</h2></div>
    <div class="card" style="margin-bottom:22px;">
      ${loading && !branches ? `<span class="hint">Loadingâ€¦</span>` : (branches && branches.length ? `
        <table style="margin-bottom:16px;"><thead><tr><th>Name</th><th>Code</th></tr></thead>
        <tbody>${branches.map(b=>`<tr><td>${b.name}</td><td class="txt">${b.code}</td></tr>`).join('')}</tbody></table>
      ` : `<div class="hint" style="margin-bottom:16px;">No branches yet.</div>`)}
      <form id="form-add-branch" style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end;">
        <div><label style="display:block; font-size:11.5px; font-weight:600; color:var(--muted); margin-bottom:4px;">Branch name</label><input type="text" name="name" placeholder="e.g. Kisumu Branch" required></div>
        <div><label style="display:block; font-size:11.5px; font-weight:600; color:var(--muted); margin-bottom:4px;">Code</label><input type="text" name="code" placeholder="e.g. kisumu" pattern="[a-z0-9-]+" required></div>
        <button class="btn gold" type="submit">Add Branch</button>
      </form>
    </div>

    <div class="section-head"><h2>Access grants</h2></div>
    <div class="card">
      ${error ? `<div class="hint" style="color:#c0392b; margin-bottom:12px;">${error}</div>` : ''}
      ${formError ? `<div class="hint" style="color:#c0392b; margin-bottom:12px;">${formError}</div>` : ''}
      ${loading && !grants ? `<span class="hint">Loadingâ€¦</span>` : `
      <div class="table-wrap"><table>
        <thead><tr><th>Person</th><th>Branch</th><th>Role</th><th></th></tr></thead>
        <tbody>
          ${(grants||[]).length===0 ? `<tr class="empty-row"><td colspan="4">No access grants yet.</td></tr>` : (grants||[]).map(g=>`
            <tr>
              <td class="txt">${g.email || '(unknown)'}</td>
              <td class="txt">${g.branches ? g.branches.name : ''}</td>
              <td class="txt" style="text-transform:capitalize;">${g.role.replace(/_/g,' ')}</td>
              <td><button class="btn ghost sm" data-revoke-user="${g.user_id}" data-revoke-branch="${g.branch_id}">Revoke</button></td>
            </tr>`).join('')}
        </tbody>
      </table></div>`}

      <form id="form-grant-access" style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin-top:18px; padding-top:18px; border-top:1px solid var(--hair);">
        <div><label style="display:block; font-size:11.5px; font-weight:600; color:var(--muted); margin-bottom:4px;">Email (must already have a Supabase account)</label><input type="email" name="email" placeholder="person@happynet.co.ke" required></div>
        <div><label style="display:block; font-size:11.5px; font-weight:600; color:var(--muted); margin-bottom:4px;">Branch</label>
          <select name="branch_id" required>${(branches||[]).map(b=>`<option value="${b.id}">${b.name}</option>`).join('')}</select>
        </div>
        <div><label style="display:block; font-size:11.5px; font-weight:600; color:var(--muted); margin-bottom:4px;">Role</label>
          <select name="role" required>${ROLE_OPTIONS.map(r=>`<option value="${r}">${r.replace(/_/g,' ')}</option>`).join('')}</select>
        </div>
        <button class="btn gold" type="submit">Grant Access</button>
      </form>
    </div>
  `;
}
function wireStaffTab(){
  const branchForm = document.getElementById('form-add-branch');
  if(branchForm) branchForm.addEventListener('submit', e=>{
    e.preventDefault();
    const fd = new FormData(branchForm);
    createBranch(fd.get('name'), fd.get('code'));
  });
  const grantForm = document.getElementById('form-grant-access');
  if(grantForm) grantForm.addEventListener('submit', e=>{
    e.preventDefault();
    const fd = new FormData(grantForm);
    grantAccess(fd.get('email'), fd.get('branch_id'), fd.get('role'));
  });
  document.querySelectorAll('[data-revoke-user]').forEach(b=>b.addEventListener('click', ()=>{
    revokeAccess(b.dataset.revokeUser, b.dataset.revokeBranch);
  }));
}


