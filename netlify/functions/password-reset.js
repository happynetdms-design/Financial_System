const { anonClient, json } = require('./_lib/supabase');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return json(400, { error: 'Invalid JSON body.' }); }

  const email = String(body.email || '').trim().toLowerCase();
  if (!email) return json(400, { error: 'Email is required.' });

  try {
    const supabase = anonClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) return json(400, { error: error.message });

    return json(200, { ok: true });
  } catch (e) {
    console.error('password reset error', e);
    return json(500, { error: 'Unexpected error sending password reset email.' });
  }
};
