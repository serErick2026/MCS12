const config = (typeof window !== 'undefined' && window.__APP_CONFIG__) || {};

export const env = Object.freeze({
  supabaseUrl: String(config.SUPABASE_URL || ''),
  supabaseAnonKey: String(config.SUPABASE_ANON_KEY || ''),
});

export function isConfigured() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
