import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
export const supabaseAuthEnabled = process.env.REACT_APP_AUTH_PROVIDER === 'supabase';
export const supabaseHomepageCatalogEnabled =
  process.env.REACT_APP_HOMEPAGE_CATALOG_PROVIDER === 'supabase';

if ((supabaseAuthEnabled || supabaseHomepageCatalogEnabled) && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error('Supabase mode is enabled but REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY is missing.');
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
