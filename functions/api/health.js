export async function onRequestGet({ env }) {
  return Response.json({
    status: 'ok',
    service: 'school-safety-intelligence',
    supabaseConfigured: Boolean(env.SUPABASE_URL),
    timestamp: new Date().toISOString(),
  });
}
