const { json } = require('./_lib/supabase');

exports.handler = async (event) => {
  if(event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed.' });

  if(!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY){
    return json(500, { error: 'Supabase auth config is not available.' });
  }

  return json(200, {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
  });
};
