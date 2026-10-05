// m3-verify.mjs — live post-application verification for stage M3
//
// Authority: M3 execution authorization (2026-10-05), post-application
// section. Zero dependencies; runtime-only credentials from .env.
// Verifies: anon denied (all 6 tables), authenticated client cannot
// INSERT/UPDATE/DELETE reports, authenticated reads reports (own-row
// path), M1 (profiles) and M2 (reference tables) still healthy,
// service-role backend path OK. Non-destructive: the only write is a
// temporary password rotation of one existing synthetic identity.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { verifyConfig, redact, IDENTITIES } from './provision-synthetic.mjs';

const ALL_TABLES = ['profiles', 'report_categories', 'locations', 'risk_criteria', 'risk_thresholds', 'reports'];

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

export async function runM3Verification({ url, serviceRoleKey, anonKey, fetchImpl, log }) {
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
        apikey: jwt ? anonKey : anonKey,
        Authorization: `Bearer ${jwt ?? anonKey}`,
        'Content-Type': 'application/json',
        ...(method !== 'GET' ? { Prefer: 'return=representation' } : {}),
      },
      body: body == null ? undefined : JSON.stringify(body),
    });
    const text = await res.text().catch(() => '');
    return { status: res.status, ok: res.ok, text };
  };

  // 1. anon denied on every table
  for (const t of ALL_TABLES) {
    const r = await call('GET', `/rest/v1/${t}?select=id&limit=1`);
    record(`anon.denied.${t}`, !r.ok, `HTTP ${r.status}`);
  }

  // 2. sign in one synthetic member (temporary password)
  const ident = IDENTITIES.find((i) => i.email === 'synthetic.member-a@school-safety.invalid');
  const pw = randomBytes(24).toString('base64url');
  secrets.push(pw);
  const rot = await call('PUT', `/auth/v1/admin/users/${ident.id}`, { password: pw }, serviceRoleKey);
  if (!rot.ok) {
    record('setup.rotate-member-a', false, `HTTP ${rot.status}`);
    return { ok: false, results };
  }
  const login = await f(`${cfg.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ident.email, password: pw }),
  });
  const lb = await login.json().catch(() => ({}));
  if (!login.ok || !lb.access_token) {
    record('setup.sign-in-member-a', false, `HTTP ${login.status}`);
    return { ok: false, results };
  }
  const jwt = lb.access_token;
  secrets.push(jwt);
  record('setup.sign-in-member-a', true, `HTTP ${login.status}`);

  // 3. authenticated reads reports (own-row path; table empty => 200 [])
  const rr = await call('GET', '/rest/v1/reports?select=id&limit=1', null, jwt);
  record('auth.reads-reports', rr.ok && rr.text.trim() === '[]', `HTTP ${rr.status}, body=${rr.text.trim().slice(0, 40)}`);

  // 4. authenticated client cannot INSERT / UPDATE / DELETE reports
  const ins = await call('POST', '/rest/v1/reports', { description: 'client write attempt must fail' }, jwt);
  record('auth.cannot-insert-reports', !ins.ok, `HTTP ${ins.status}`);
  const upd = await call('PATCH', '/rest/v1/reports?status=eq.submitted', { status: 'dismissed' }, jwt);
  record('auth.cannot-update-reports', !upd.ok, `HTTP ${upd.status}`);
  const del = await call('DELETE', '/rest/v1/reports?status=eq.submitted', null, jwt);
  record('auth.cannot-delete-reports', !del.ok, `HTTP ${del.status}`);

  // 5. M1 sanity: own profile readable; M2 sanity: reference tables readable
  const prof = await call('GET', `/rest/v1/profiles?id=eq.${ident.id}&select=id,role`, null, jwt);
  let ownOk = false;
  try { ownOk = JSON.parse(prof.text)?.[0]?.id === ident.id; } catch { ownOk = false; }
  record('m1.own-profile-readable', prof.ok && ownOk, `HTTP ${prof.status}`);
  const cat = await call('GET', '/rest/v1/report_categories?select=id&limit=1', null, jwt);
  record('m2.categories-readable', cat.ok, `HTTP ${cat.status}`);
  const risk = await call('GET', '/rest/v1/risk_criteria?select=id&limit=1', null, jwt);
  record('m2.risk-reachable', risk.ok, `HTTP ${risk.status} (empty tables: officer row-scoping not observable — deferred to seeding)`);

  // 6. privileged backend still denied for normal user
  const adm = await call('GET', '/auth/v1/admin/users?page=1&per_page=1', null, jwt);
  record('auth.admin-api-denied', !adm.ok, `HTTP ${adm.status}`);

  // 7. service-role backend path reads reports
  const svc = await call('GET', '/rest/v1/reports?select=id&limit=1', null, serviceRoleKey);
  record('backend.reads-reports', svc.ok, `HTTP ${svc.status}`);

  // 8. profiles population unchanged (5 synthetic)
  const all = await call('GET', '/rest/v1/profiles?select=id', null, serviceRoleKey);
  let count = -1;
  try { count = JSON.parse(all.text).length; } catch { count = -1; }
  record('integrity.exactly-5-profiles', count === 5, `count=${count}`);

  const ok = results.every((r) => r.pass);
  return { ok, passed: results.filter((r) => r.pass).length, failed: results.filter((r) => !r.pass).length, results };
}

async function main(argv) {
  if (argv.length !== 0) {
    console.error('usage: node scripts/m3-verify.mjs');
    return 2;
  }
  const env = { ...(await readDotEnv()), ...process.env };
  verifyConfig(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const s = await runM3Verification({
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
