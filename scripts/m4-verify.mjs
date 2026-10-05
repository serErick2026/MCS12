// m4-verify.mjs — live post-application verification for stage M4
//
// Authority: G-3 approval for 0004_correlation.sql (2026-10-05),
// post-application section. Zero dependencies; runtime-only credentials
// from .env. Verifies: anon denied (all 8 tables), member/officer client
// paths on incidents + incident_reports (RLS INSERT denial, community
// column lockdown O-05/O-09, no client DELETE), M1-M3 regression
// (profiles/reports/reference reads + reports write denials),
// service-role backend path OK, exactly 5 profiles.
// Non-destructive: the only writes are temporary password rotations of
// two existing synthetic identities; no row data is created or removed.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { verifyConfig, redact, IDENTITIES } from './provision-synthetic.mjs';

const ALL_TABLES = [
  'profiles', 'report_categories', 'locations', 'risk_criteria',
  'risk_thresholds', 'reports', 'incidents', 'incident_reports',
];

async function readDotEnv() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const raw = await readFile(path.join(root, '.env'), 'utf8');
    const out = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && m[2]) out[m[1]] = m[2].trim();
    }
    return out;
  } catch {
    return {};
  }
}

async function signIn(f, cfg, anonKey, email, secrets, record, label) {
  const ident = IDENTITIES.find((i) => i.email === email);
  if (!ident) {
    record(`setup.identity.${label}`, false, 'IDENTITIES entry missing');
    return null;
  }
  const pw = randomBytes(24).toString('base64url');
  secrets.push(pw);
  const rot = await f(`${cfg.url}/auth/v1/admin/users/${ident.id}`, {
    method: 'PUT',
    headers: { apikey: secrets[0], Authorization: `Bearer ${secrets[0]}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pw }),
  });
  if (!rot.ok) {
    record(`setup.rotate.${label}`, false, `HTTP ${rot.status}`);
    return null;
  }
  const login = await f(`${cfg.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pw }),
  });
  const lb = await login.json().catch(() => ({}));
  if (!login.ok || !lb.access_token) {
    record(`setup.sign-in.${label}`, false, `HTTP ${login.status}`);
    return null;
  }
  secrets.push(lb.access_token);
  record(`setup.sign-in.${label}`, true, `HTTP ${login.status}`);
  return { ident, jwt: lb.access_token };
}

export async function runM4Verification({ url, serviceRoleKey, anonKey, fetchImpl, log }) {
  const cfg = verifyConfig(url, serviceRoleKey);
  if (!anonKey) throw new Error('SUPABASE_ANON_KEY missing');
  const f = fetchImpl ?? globalThis.fetch;
  const logger = log ?? { info() {} };
  const secrets = [serviceRoleKey, anonKey];
  const results = [];
  const record = (name, pass, detail) => {
    results.push({ name, pass, detail: redact(String(detail), secrets) });
    logger.info(`${pass ? 'PASS' : 'FAIL'} ${name} — ${redact(String(detail), secrets)}`);
  };
  const call = async (method, pathname, body, jwt) => {
    const res = await f(`${cfg.url}${pathname}`, {
      method,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${jwt ?? anonKey}`,
        'Content-Type': 'application/json',
        ...(method !== 'GET' ? { Prefer: 'return=representation' } : {}),
      },
      body: body == null ? undefined : JSON.stringify(body),
    });
    const text = await res.text().catch(() => '');
    return { status: res.status, ok: res.ok, text };
  };

  // 1. anon denied on every table (8)
  for (const t of ALL_TABLES) {
    const r = await call('GET', `/rest/v1/${t}?select=id&limit=1`);
    record(`anon.denied.${t}`, !r.ok, `HTTP ${r.status}`);
  }

  // 2. sign in synthetic member + officer (temporary passwords)
  const member = await signIn(f, cfg, anonKey, 'synthetic.member-a@school-safety.invalid', secrets, record, 'member-a');
  const officer = await signIn(f, cfg, anonKey, 'synthetic.safety-officer@school-safety.invalid', secrets, record, 'safety-officer');
  if (!member || !officer) return { ok: false, results };

  // 3. member reads on new tables: 200 with empty body (RLS filters; table empty)
  const mi = await call('GET', '/rest/v1/incidents?select=id&limit=1', null, member.jwt);
  record('member.reads-incidents-empty', mi.ok && mi.text.trim() === '[]', `HTTP ${mi.status}, body=${mi.text.trim().slice(0, 40)}`);
  const ml = await call('GET', '/rest/v1/incident_reports?select=id&limit=1', null, member.jwt);
  record('member.reads-incident-reports-empty', ml.ok && ml.text.trim() === '[]', `HTTP ${ml.status}, body=${ml.text.trim().slice(0, 40)}`);

  // 4. member client INSERT denied by officer-only RLS policies
  const ii = await call('POST', '/rest/v1/incidents',
    { title: 'client write must fail', first_reported_at: new Date().toISOString(), last_reported_at: new Date().toISOString() },
    member.jwt);
  record('member.cannot-insert-incidents', !ii.ok, `HTTP ${ii.status}`);
  const li = await call('POST', '/rest/v1/incident_reports',
    { incident_id: '00000000-0000-4000-8000-000000000000', report_id: '00000000-0000-4000-8000-000000000000', link_method: 'manual' },
    member.jwt);
  record('member.cannot-insert-incident-reports', !li.ok, `HTTP ${li.status}`);

  // 5. community / backend-owned columns unreachable from clients (O-05/O-09)
  const cu = await call('PATCH', '/rest/v1/incidents?id=eq.00000000-0000-4000-8000-000000000000',
    { community_summary: 'client must not write this' }, member.jwt);
  record('member.cannot-write-community-columns', !cu.ok, `HTTP ${cu.status}`);
  const cuo = await call('PATCH', '/rest/v1/incidents?id=eq.00000000-0000-4000-8000-000000000000',
    { community_guidance: 'officer must not write this either' }, officer.jwt);
  record('officer.cannot-write-community-columns', !cuo.ok, `HTTP ${cuo.status}`);

  // 6. no client DELETE on either new table (grant-level denial)
  const di = await call('DELETE', '/rest/v1/incidents?id=eq.00000000-0000-4000-8000-000000000000', null, officer.jwt);
  record('officer.cannot-delete-incidents', !di.ok, `HTTP ${di.status}`);
  const dl = await call('DELETE', '/rest/v1/incident_reports?id=eq.00000000-0000-4000-8000-000000000000', null, officer.jwt);
  record('officer.cannot-delete-incident-reports', !dl.ok, `HTTP ${dl.status}`);
  const dlm = await call('DELETE', '/rest/v1/incident_reports?id=eq.00000000-0000-4000-8000-000000000000', null, member.jwt);
  record('member.cannot-delete-incident-reports', !dlm.ok, `HTTP ${dlm.status}`);

  // 7. officer read path on new tables (empty => row-scoping unobservable,
  //    but officer-select policy must be reachable)
  const oi = await call('GET', '/rest/v1/incidents?select=id&limit=1', null, officer.jwt);
  record('officer.reads-incidents', oi.ok, `HTTP ${oi.status} (empty table: officer-vs-member row-scoping deferred to seeded data)`);
  const ol = await call('GET', '/rest/v1/incident_reports?select=id&limit=1', null, officer.jwt);
  record('officer.reads-incident-reports', ol.ok, `HTTP ${ol.status}`);

  // 8. M3 regression: reports read/write posture unchanged
  const rr = await call('GET', '/rest/v1/reports?select=id&limit=1', null, member.jwt);
  record('m3.reads-reports-own-path', rr.ok && rr.text.trim() === '[]', `HTTP ${rr.status}, body=${rr.text.trim().slice(0, 40)}`);
  const ins = await call('POST', '/rest/v1/reports', { description: 'client write attempt must fail' }, member.jwt);
  record('m3.cannot-insert-reports', !ins.ok, `HTTP ${ins.status}`);
  const upd = await call('PATCH', '/rest/v1/reports?status=eq.submitted', { status: 'dismissed' }, member.jwt);
  record('m3.cannot-update-reports', !upd.ok, `HTTP ${upd.status}`);
  const del = await call('DELETE', '/rest/v1/reports?status=eq.submitted', null, member.jwt);
  record('m3.cannot-delete-reports', !del.ok, `HTTP ${del.status}`);

  // 9. M1/M2 regression
  const prof = await call('GET', `/rest/v1/profiles?id=eq.${member.ident.id}&select=id,role`, null, member.jwt);
  let ownOk = false;
  try { ownOk = JSON.parse(prof.text)?.[0]?.id === member.ident.id; } catch { ownOk = false; }
  record('m1.own-profile-readable', prof.ok && ownOk, `HTTP ${prof.status}`);
  const cat = await call('GET', '/rest/v1/report_categories?select=id&limit=1', null, officer.jwt);
  record('m2.categories-readable', cat.ok, `HTTP ${cat.status}`);
  const risk = await call('GET', '/rest/v1/risk_criteria?select=id&limit=1', null, officer.jwt);
  record('m2.risk-reachable', risk.ok, `HTTP ${risk.status} (empty tables: row-scoping not observable — deferred to seeding)`);

  // 10. authz + backend path
  const adm = await call('GET', '/auth/v1/admin/users?page=1&per_page=1', null, member.jwt);
  record('auth.admin-api-denied', !adm.ok, `HTTP ${adm.status}`);
  const svc = await call('GET', '/rest/v1/incidents?select=id&limit=1', null, serviceRoleKey);
  record('backend.reads-incidents', svc.ok, `HTTP ${svc.status}`);
  const svcl = await call('GET', '/rest/v1/incident_reports?select=id&limit=1', null, serviceRoleKey);
  record('backend.reads-incident-reports', svcl.ok, `HTTP ${svcl.status}`);

  // 11. population integrity (5 synthetic profiles unchanged)
  const all = await call('GET', '/rest/v1/profiles?select=id', null, serviceRoleKey);
  let count = -1;
  try { count = JSON.parse(all.text).length; } catch { count = -1; }
  record('integrity.exactly-5-profiles', count === 5, `count=${count}`);

  const ok = results.every((r) => r.pass);
  return { ok, passed: results.filter((r) => r.pass).length, failed: results.filter((r) => !r.pass).length, results };
}

async function main(argv) {
  if (argv.length !== 0) {
    console.error('usage: node scripts/m4-verify.mjs');
    return 2;
  }
  const env = { ...(await readDotEnv()), ...process.env };
  verifyConfig(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const s = await runM4Verification({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    anonKey: env.SUPABASE_ANON_KEY,
    fetchImpl: globalThis.fetch,
    log: { info: (m) => console.log(m) },
  });
  console.log(JSON.stringify({ ok: s.ok, passed: s.passed, failed: s.failed }, null, 2));
  return s.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(redact(err?.message ?? String(err), [process.env.SUPABASE_SERVICE_ROLE_KEY]));
      process.exit(1);
    },
  );
}
