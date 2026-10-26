const { createClient } = require('@supabase/supabase-js');
const supabase = require('../config/supabase');

async function verifyCurrentPassword(authUserId, email, password) {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw Object.assign(new Error('Supabase Auth verification is not configured.'), { status: 503 });
  }

  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error?.code === 'invalid_credentials' || (data.user && data.user.id !== authUserId)) {
    throw Object.assign(new Error('Current password is incorrect.'), { status: 401 });
  }
  if (error || !data.user) {
    throw Object.assign(new Error('Supabase Auth could not verify the current password.'), { status: 503 });
  }
}

async function updateSupabasePassword(authUserId, password) {
  const { error } = await supabase.auth.admin.updateUserById(authUserId, { password });
  if (error) {
    throw Object.assign(new Error('Supabase Auth password could not be updated.'), { status: 503, code: error.code });
  }
}

module.exports = { verifyCurrentPassword, updateSupabasePassword };
