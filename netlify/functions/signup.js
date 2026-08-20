const { anonClient, json } = require('./_lib/supabase');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return json(400, { error: 'Invalid JSON body.' }); }

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email || !password) return json(400, { error: 'Email and password are required.' });
  if (password.length < 8) return json(400, { error: 'Password must be at least 8 characters.' });

  try {
    const supabase = anonClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return json(400, { error: error.message });

    const response = { user: data.user ? { id: data.user.id, email: data.user.email } : null };
    if (data.session) {
      response.access_token = data.session.access_token;
      response.refresh_token = data.session.refresh_token;
      response.expires_at = data.session.expires_at;
    }

    return json(200, response);
  } catch (e) {
    console.error('signup error', e);
    return json(500, { error: 'Unexpected error creating account.' });
  }
};
