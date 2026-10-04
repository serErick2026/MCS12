// a52-verify.mjs — A5.2 deferred-verification harness (live, read-mostly)
//
// Project:   MCS12 / School Safety Intelligence and Notification System
// Authority: A5.2 execution preflight (researcher-approved 2026-10-05);
//            D-G2-02 deferred items (1)-(4); A5 proposal §6 steps (4)-(5).
// Scope:     runs against the linked MCS12 project ONLY. For each of the
//            five provisioned synthetic identities: rotate that identity's
//            own password (temporary), sign in, execute the deferred
//            tests, discard credentials in-process.
// Non-destructive by construction: the only writes are (a) password
// rotation of the five synthetic accounts, (b) display-name change of
// the tested row with immediate restore. No deletes, no role writes,
// no unrelated accounts, no schema/policy changes.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { IDENTITIES, EXPECTED_PROJECT_REF, verifyConfig, redact } from './provision-synthetic.mjs';

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

export async function runVerification({ url, serviceRoleKey, anonKey, fetchImpl, log }) {
  const cfg = verifyConfig(url, serviceRoleKey);
  if (!anonKey) throw new Error('SUPABASE_ANON_KEY missing');
  const f = fetchImpl ?? globalThis.fetch;
  const logger = log ?? { info() {}, error() {} };
  const secrets = [serviceRoleKey, anonKey];
  const say = (m) => logger.info(redact(m, secrets));

  const results = [];
  const record = (test, ident, pass, detail) => {
    results.push({ test, identity: ident?.email ?? 'all', pass, detail: redact(String(detail), secrets) });
    say(`${pass ? 'PASS' : 'FAIL'} ${test} [${ident?.email ?? 'all'}] ${redact(String(detail), secrets)}`);
  };

  const req = async (method, pathname, body, jwt) => {
    const res = await f(`${cfg.url}${pathname}`, {
      method,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${jwt ?? serviceRoleKey}`,
        'Content-Type': 'application/json',
        ...(method !== 'GET' ? { Prefer: 'return=representation' } : {}),
      },
      body: body == null ? undefined : JSON.stringify(body),
    });
    const text = await res.text().catch(() => '');
    return { status: res.status, ok: res.ok, text };
  };

  for (const ident of IDENTITIES) {
    // 0. temporary password for THIS run only, then sign in
    const pw = randomBytes(24).toString('base64url');
    secrets.push(pw);
    const rot = await req('PUT', `/auth/v1/admin/users/${ident.id}`, { password: pw });
    if (!rot.ok) {
      record('setup.password-rotate', ident, false, `HTTP ${rot.status}`);
      break;
    }
    const login = await f(`${cfg.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ident.email, password: pw }),
    });
    const loginBody = await login.json().catch(() => ({}));
    if (!login.ok || !loginBody.access_token) {
      record('setup.sign-in', ident, false, `HTTP ${login.status}`);
      break;
    }
    const jwt = loginBody.access_token;
    secrets.push(jwt);
    record('setup.sign-in', ident, true, `HTTP ${login.status}`);

    // negative sanity: wrong password must fail
    const bad = await f(`${cfg.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ident.email, password: `${pw}x` }),
    });
    record('sanity.wrong-password-denied', ident, !bad.ok, `HTTP ${bad.status}`);

    // (1) authenticated own-row access
    const own = await req('GET', `/rest/v1/profiles?id=eq.${ident.id}&select=id,role,display_name,is_synthetic`, null, jwt);
    let ownRow = null;
    try {
      const rows = JSON.parse(own.text);
      ownRow = Array.isArray(rows) && rows.length === 1 && rows[0].id === ident.id ? rows[0] : null;
    } catch { ownRow = null; }
    record('deferred-1.own-row', ident, own.ok && ownRow !== null && ownRow.role === ident.role && ownRow.is_synthetic === true, own.ok ? (ownRow ? 'exactly one own row, role+synthetic match' : 'row shape mismatch') : `HTTP ${own.status}`);

    // (2) role self-escalation prevention (attempt to change own role)
    const targetRole = ident.role === 'administrator' ? 'safety_officer' : 'administrator';
    const esc = await req('PATCH', `/rest/v1/profiles?id=eq.${ident.id}`, { role: targetRole }, jwt);
    const check = await req('GET', `/rest/v1/profiles?id=eq.${ident.id}&select=role`, null, jwt);
    let roleNow = null;
    try { roleNow = JSON.parse(check.text)?.[0]?.role ?? null; } catch { roleNow = null; }
    record('deferred-2.escalation-blocked', ident, !esc.ok && roleNow === ident.role, esc.ok ? 'UNEXPECTED: role write accepted' : `write HTTP ${esc.status}; role still '${roleNow}'`);

    // (3) display-name update (change + verify + restore)
    const originalName = ownRow?.display_name ?? null;
    const testName = `A52 Verify ${ident.role}`;
    const upd = await req('PATCH', `/rest/v1/profiles?id=eq.${ident.id}`, { display_name: testName }, jwt);
    const reread = await req('GET', `/rest/v1/profiles?id=eq.${ident.id}&select=display_name`, null, jwt);
    let nameNow = null;
    try { nameNow = JSON.parse(reread.text)?.[0]?.display_name ?? null; } catch { nameNow = null; }
    const changed = upd.ok && nameNow === testName;
    const restore = await req('PATCH', `/rest/v1/profiles?id=eq.${ident.id}`, { display_name: originalName ?? 'Synthetic Placeholder' }, jwt);
    const finalRead = await req('GET', `/rest/v1/profiles?id=eq.${ident.id}&select=display_name`, null, jwt);
    let finalName = null;
    try { finalName = JSON.parse(finalRead.text)?.[0]?.display_name ?? null; } catch { finalName = null; }
    const restored = restore.ok && finalName === (originalName ?? 'Synthetic Placeholder');
    record('deferred-3.display-name-update', ident, changed && restored, `changed=${changed} restored=${restored}`);

    // (4) privileged backend access attempts (all must fail)
    const adm = await req('GET', '/auth/v1/admin/users?page=1&per_page=1', null, jwt);
    record('deferred-4a.admin-api-denied', ident, !adm.ok, `HTTP ${adm.status}`);
    const ins = await req('POST', '/rest/v1/profiles', { id: 'b0000000-0000-4000-8000-0000000000ff', role: 'member' }, jwt);
    record('deferred-4b.profile-insert-denied', ident, !ins.ok, `HTTP ${ins.status}`);

    // reference-table access posture (schema exists; tables empty by EX-07)
    const cat = await req('GET', '/rest/v1/report_categories?select=id&limit=1', null, jwt);
    record('sanity.categories-readable-authenticated', ident, cat.ok, `HTTP ${cat.status}`);
    const risk = await req('GET', '/rest/v1/risk_criteria?select=id&limit=1', null, jwt);
    record('sanity.risk-table-reachable', ident, risk.ok, `HTTP ${risk.status} (empty tables: row-level officer scoping NOT distinguishable until EX-07/O-01 seeding — recorded honestly)`);

    secrets.splice(secrets.indexOf(pw), 1);
    secrets.splice(secrets.indexOf(jwt), 1);
  }

  // anon auth sanity against the four reference tables (no user JWT)
  for (const t of ['report_categories', 'locations', 'risk_criteria', 'risk_thresholds']) {
    const r = await f(`${cfg.url}/rest/v1/${t}?select=id&limit=1`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    record(`sanity.anon-denied.${t}`, null, !r.ok, `HTTP ${r.status}`);
  }

  const ok = results.every((r) => r.pass);
  return { ok, passed: results.filter((r) => r.pass).length, failed: results.filter((r) => !r.pass).length, results };
}

async function main(argv) {
  if (argv.length !== 0) {
    console.error('usage: node scripts/a52-verify.mjs');
    return 2;
  }
  const env = { ...(await readDotEnv()), ...process.env };
  try {
    verifyConfig(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  } catch (err) {
    console.error(`configuration error: ${err.message}`);
    return 1;
  }
  const summary = await runVerification({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    anonKey: env.SUPABASE_ANON_KEY,
    fetchImpl: globalThis.fetch,
    log: { info: (m) => console.log(m), error: (m) => console.error(m) },
  });
  console.log(JSON.stringify({ ok: summary.ok, passed: summary.passed, failed: summary.failed }, null, 2));
  return summary.ok ? 0 : 1;
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
