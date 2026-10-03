import { createClient } from '@supabase/supabase-js';
import { env, isConfigured } from '../config/env.js';

let client = null;

export function getSupabase() {
  if (client) return client;

  if (!isConfigured()) {
    console.warn('Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env and rebuild.');
    return null;
  }

  client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return client;
}
