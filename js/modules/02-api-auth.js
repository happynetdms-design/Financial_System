/* Extracted from app.js; load order is intentional. */
/* ---------------- API layer (talks to Netlify Functions only) ---------------- */
const SESSION_KEY = 'happynet_session';
function notifyAuth(message, type='error'){
  if(typeof window !== 'undefined' && typeof window.showToast === 'function') window.showToast(message, type);
  else console.warn(message);
}

function getSession(){
  try{
    const stored = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  }
  catch(e){ return null; }
}

function setSession(s, remember=true){
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  if(s) (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(s));
}

async function apiLogin(email, password, remember=true){
  const res = await fetch('/api/login', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ email, password })
  });
  const body = await res.json();
  if(!res.ok) throw new Error(body.error || 'Sign in failed.');
  setSession(body, remember);
  return body;
}

async function apiSignup(email, password){
  const res = await fetch('/api/signup', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ email, password })
  });
  const body = await res.json();
  if(!res.ok) throw new Error(body.error || 'Account creation failed.');
  if(body.access_token) setSession(body, true);
  return body;
}

async function apiResetPassword(email){
  const res = await fetch('/api/password-reset', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ email })
  });
  const body = await res.json();
  if(!res.ok) throw new Error(body.error || 'Unable to send password reset email.');
  return body;
}

async function apiRefresh(){
  const s = getSession();
  if(!s || !s.refresh_token){
    setSession(null);
    notifyAuth('Your session has expired. Please sign in again.');
    window.location.replace('/');
    return false;
  }
  try{
    const res = await fetch('/api/refresh', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ refresh_token: s.refresh_token })
    });
    if(!res.ok) {
      setSession(null);
      notifyAuth('Your session has expired. Please sign in again.');
      window.location.replace('/');
      return false;
    }
    const body = await res.json();
    setSession(body, Boolean(localStorage.getItem(SESSION_KEY)));
    return true;
  }catch(e){
    setSession(null);
    notifyAuth('Your session could not be refreshed. Please sign in again.');
    window.location.replace('/');
    return false;
  }
}

async function apiLogout(){
  const s = getSession();
  try{
    await fetch('/api/logout', {
      method:'POST', headers:{'Authorization':'Bearer '+(s ? s.access_token : '')}
    });
  }catch(e){ /* ignore - clear local session regardless */ }
  setSession(null);
}

// Wraps fetch to /api/*: attaches the bearer token and retries once after a
// silent refresh if the token turned out to be expired.
async function apiFetch(path, options={}, _retried){
  const s = getSession();
  const headers = Object.assign({}, options.headers, { 'Authorization':'Bearer '+(s ? s.access_token : '') });
  const res = await fetch(path, Object.assign({}, options, { headers }));
  if(res.status === 401 && !_retried){
    const refreshed = await apiRefresh();
    if(refreshed) return apiFetch(path, options, true);
  }
  return res;
}

async function apiGetState(){
  const res = await apiFetch('/api/state', { method:'GET' });
  if(!res.ok) throw new Error('unauthorized');
  const body = await res.json();
  return body.data || {};
}

async function apiSaveState(data){
  const res = await apiFetch('/api/state', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ data })
  });
  if(!res.ok) throw new Error('save failed');
  return true;
}

// Per-branch home for categories/monthlyArchive/closedMonths — see
// supabase/branch_misc_state.sql for why this exists separately from
// apiGetState()/apiSaveState() above, which still hit the old single-row
// /api/state purely as a whole-app mirror/rollback point.
async function apiGetBranchMisc(branchId){
  const res = await apiFetch('/api/branch-state?branch_id=' + branchId, { method:'GET' });
  if(!res.ok) throw new Error('Could not load branch data.');
  const body = await res.json();
  return body.data || {};
}

async function apiSaveBranchMisc(branchId, data){
  const res = await apiFetch('/api/branch-state', {
    method:'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branch_id: branchId, data })
  });
  if(!res.ok) throw new Error('Could not save branch data.');
  return true;
}


let supabaseClient;

async function loadSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  const res = await fetch('/api/auth-config');
  if (!res.ok) throw new Error('Unable to load Supabase config.');

  const data = await res.json();
  if (!data.SUPABASE_URL || !data.SUPABASE_ANON_KEY) {
    throw new Error('Supabase client config is missing.');
  }

  // Set persistSession: true (default) so PKCE code verifiers persist across redirects
  supabaseClient = window.supabase.createClient(data.SUPABASE_URL, data.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true
    }
  });

  return supabaseClient;
}

async function handleOAuthCallback() {
  try {
    const supabase = await loadSupabaseClient();
    
    // Check if Google redirected back with an authorization code
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      // Exchange PKCE Auth Code for Session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.warn('OAuth callback error:', error.message || error);
        return false;
      }

      if (data && data.session) {
        const { access_token, refresh_token, expires_at, user } = data.session;

        setSession({
          access_token,
          refresh_token,
          expires_at,
          user: { id: user.id, email: user.email, role: 'viewer' }
        });

        // Clean up code query parameter from browser address bar
        window.history.replaceState({}, document.title, window.location.pathname);
        return true;
      }
    }
  } catch (e) {
    console.warn('OAuth callback failed', e);
  }

  return false;
}

async function signInWithGoogle() {
  const googleBtn = document.getElementById('google-signin');
  if (!googleBtn) return;

  const originalLabel = googleBtn.innerHTML;
  googleBtn.disabled = true;
  googleBtn.innerHTML = 'Redirecting...';

  try {
    const supabase = await loadSupabaseClient();

    // Initiate Google OAuth flow targeting current origin
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) throw error;

    if (data && data.url) {
      window.location.href = data.url;
      return;
    }

    throw new Error('Unable to start Google sign-in.');
  } catch (e) {
    alert('Google sign-in failed: ' + (e.message || e));
    googleBtn.disabled = false;
    googleBtn.innerHTML = originalLabel;
  }
}