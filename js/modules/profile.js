/* Standalone profile route. Loaded with the classic application modules. */
(function(){
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  window.showToast = window.showToast || function(message, type = 'info'){
    let host = document.getElementById('toast-host');
    if(!host){ host = document.createElement('div'); host.id = 'toast-host'; host.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:9999;display:grid;gap:8px;max-width:360px'; document.body.appendChild(host); }
    const item = document.createElement('div'); item.textContent = message; item.dataset.type = type;
    item.style.cssText = 'padding:12px 16px;border-radius:8px;background:#17212b;color:#fff;box-shadow:0 8px 24px #0003;font:500 14px/1.4 sans-serif';
    host.appendChild(item); setTimeout(() => item.remove(), 4200);
  };
  window.alert = function(message){ window.showToast(message, 'error'); };
  async function request(path, options){
    const response = await apiFetch(path, options || {});
    const data = await response.json().catch(() => ({}));
    if(!response.ok) throw new Error(data.error || 'Request failed.');
    return data;
  }
  function shell(content){ return `<div style="max-width:1100px;margin:0 auto;padding:32px 20px"><div style="display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:24px"><div><p class="eyebrow">Account</p><h1>User Profile</h1><p class="sub">Manage identity, access, security, and notification preferences.</p></div><a class="btn ghost" href="/">Back to dashboard</a></div>${content}</div>`; }
  function tab(id, label, active){ return `<button class="btn ${active === id ? 'gold' : 'ghost'} sm" data-profile-tab="${id}">${label}</button>`; }
  let profileData = null;
  let active = 'personal';
  function renderTab(){
    const d = profileData || { profile:{}, user:{}, branches:[] };
    if(active === 'personal') return `<div class="form-card"><div class="form-row"><div><label>First name</label><input id="profile-first" value="${esc(d.profile.first_name)}"></div><div><label>Last name</label><input id="profile-last" value="${esc(d.profile.last_name)}"></div></div><div class="form-row"><div><label>Phone</label><input id="profile-phone" value="${esc(d.profile.phone)}"></div><div><label>Job title</label><input id="profile-title" value="${esc(d.profile.job_title)}"></div></div><div><label>Department</label><input id="profile-department" value="${esc(d.profile.department)}"></div><button class="btn gold" id="profile-save">Save profile</button><hr><p class="hint">Created ${esc(d.user.created_at || 'unknown')} · Last sign-in ${esc(d.user.last_sign_in_at || 'not available')} · Login method ${esc(d.user.provider || 'email')}</p><h3>Change password</h3><input id="profile-password" type="password" minlength="8" placeholder="New password"><button class="btn ghost" id="password-save">Update password</button></div>`;
    if(active === 'access') return `<div class="form-card"><h2>Branch access and roles</h2><div class="table-wrap"><table><thead><tr><th>Branch</th><th>Role</th><th>Granted</th></tr></thead><tbody>${(d.branches || []).map(b => `<tr><td>${esc(b.branches?.name || b.branch_id)}</td><td>${esc(b.role)}</td><td>${esc(b.granted_at || '')}</td></tr>`).join('') || '<tr><td colspan="3">No branch assignments found.</td></tr>'}</tbody></table></div></div>`;
    if(active === 'security') return `<div class="form-card"><h2>Security and active sessions</h2><p class="hint">Current browser session · ${esc(navigator.userAgent)} · Last activity now</p><button class="btn ghost" id="signout-others">Sign out of all other devices</button></div>`;
    const prefs = d.profile.preferences || {};
    return `<div class="form-card"><h2>Preferences</h2><label class="check-row"><input type="checkbox" id="pref-notifications" ${prefs.notifications !== false ? 'checked' : ''}> System notifications</label><label class="check-row"><input type="checkbox" id="pref-weekly" ${prefs.weekly_summary !== false ? 'checked' : ''}> Weekly financial summaries</label><label>Theme<select id="pref-theme"><option ${prefs.theme === 'light' ? 'selected' : ''}>light</option><option ${prefs.theme === 'dark' ? 'selected' : ''}>dark</option><option ${!prefs.theme || prefs.theme === 'system' ? 'selected' : ''}>system</option></select></label><button class="btn gold" id="prefs-save">Save preferences</button></div>`;
  }
  function render(){
    document.getElementById('root').innerHTML = shell(`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">${['personal','access','security','preferences'].map(id => tab(id, id[0].toUpperCase()+id.slice(1), active)).join('')}</div><div id="profile-panel">${profileData ? renderTab() : '<div class="form-card">Loading profile...</div>'}</div>`);
    document.querySelectorAll('[data-profile-tab]').forEach(button => button.addEventListener('click', () => { active = button.dataset.profileTab; render(); }));
    document.getElementById('profile-save')?.addEventListener('click', async () => { try { await request('/api/profile', { method:'PUT', headers:JSONH, body:JSON.stringify({first_name:document.getElementById('profile-first').value,last_name:document.getElementById('profile-last').value,phone:document.getElementById('profile-phone').value,job_title:document.getElementById('profile-title').value,department:document.getElementById('profile-department').value}) }); showToast('Profile saved.', 'success'); } catch(e) { showToast(e.message, 'error'); } });
    document.getElementById('password-save')?.addEventListener('click', async () => { try { const supabase = await loadSupabaseClient(); const password = document.getElementById('profile-password').value; if(password.length < 8) throw new Error('Password must be at least 8 characters.'); const { error } = await supabase.auth.updateUser({ password }); if(error) throw error; showToast('Password updated.', 'success'); } catch(e) { showToast(e.message, 'error'); } });
    document.getElementById('signout-others')?.addEventListener('click', async () => { try { await request('/api/profile', {method:'POST',headers:JSONH,body:JSON.stringify({action:'sign_out_other_devices'})}); showToast('Other sessions signed out.', 'success'); } catch(e) { showToast(e.message, 'error'); } });
    document.getElementById('prefs-save')?.addEventListener('click', async () => { try { await request('/api/profile', {method:'PUT',headers:JSONH,body:JSON.stringify({preferences:{notifications:document.getElementById('pref-notifications').checked,weekly_summary:document.getElementById('pref-weekly').checked,theme:document.getElementById('pref-theme').value}})}); showToast('Preferences saved.', 'success'); } catch(e) { showToast(e.message, 'error'); } });
  }
  window.startProfileApp = async function(){ try { profileData = await request('/api/profile'); render(); } catch(e) { showToast(e.message, 'error'); window.location.replace('/'); } };
})();
