// provision-synthetic.mjs — A5.1 synthetic-user provisioning (M1 mechanism)
//
// Project:   School Safety Intelligence and Notification System (MCS12)
// Authority: D-A5-02 (M1 approved) via D-A5-01; proposal:
//            docs/a5-synthetic-user-provisioning-proposed.md (EX-09).
// Scope:     LOCAL IMPLEMENTATION + MOCKED VALIDATION ONLY (A5.1).
//            Remote execution requires the separate A5.2 preflight
//            approval. No call may be made to a live project in A5.1.
//
// Rules (binding): zero dependencies; runtime-only service-role key
// (never committed/logged/persisted); fixed allowlist of five synthetic
// identities (.invalid namespace, fixed UUIDs); fail closed on config,
// target, API, or state mismatches; idempotent reuse — never modify or
// delete unrelated or unexpected accounts; no destructive cleanup.

import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const EXPECTED_PROJECT_REF = 'idytcuiecducelmwqrbo';

export const IDENTITIES = Object.freeze([
  Object.freeze({
    id: 'a0000000-0000-4000-8000-000000000001',
    email: 'synthetic.administrator@school-safety.invalid',
    role: 'administrator',
    displayName: 'Synthetic Administrator',
  }),
  Object.freeze({
    id: 'a0000000-0000-4000-8000-000000000002',
    email: 'synthetic.safety-officer@school-safety.invalid',
    role: 'safety_officer',
    displayName: 'Synthetic Safety Officer',
  }),
  Object.freeze({
    id: 'a0000000-0000-4000-8000-000000000003',
    email: 'synthetic.member-a@school-safety.invalid',
    role: 'member',
    displayName: 'Synthetic Member A',
  }),
  Object.freeze({
    id: 'a0000000-0000-4000-8000-000000000004',
    email: 'synthetic.member-b@school-safety.invalid',
    role: 'member',
    displayName: 'Synthetic Member B',
  }),
  Object.freeze({
    id: 'a0000000-0000-4000-8000-000000000005',
    email: 'synthetic.viewer@school-safety.invalid',
    role: 'viewer',
    displayName: 'Synthetic Viewer',
  }),
]);

export function redact(text, secrets) {
  let out = String(text ?? '');
  for (const s of secrets) {
    if (s && typeof s === 'string') out = out.split(s).join('[REDACTED]');
  }
  return out;
}

export function verifyConfig(url, serviceRoleKey) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new Error('SUPABASE_URL missing or empty');
  }
  if (!serviceRoleKey || typeof serviceRoleKey !== 'string' || !serviceRoleKey.trim()) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY missing or empty');
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('SUPABASE_URL is not a valid URL');
  }
  if (parsed.protocol !== 'https:') throw new Error('SUPABASE_URL must be https');
  const expectedHost = `${EXPECTED_PROJECT_REF}.supabase.co`;
  if (parsed.host !== expectedHost) {
    throw new Error(`target mismatch: url host ${parsed.host} != approved ${expectedHost}`);
  }
  return { url: parsed.origin, serviceRoleKey };
}

export async function provision({ url, serviceRoleKey, mode, fetchImpl, log }) {
  const cfg = verifyConfig(url, serviceRoleKey);
  if (mode !== 'dry-run' && mode !== 'execute') {
    throw new Error(`invalid mode: ${String(mode)}`);
  }
  const f = fetchImpl ?? globalThis.fetch;
  if (typeof f !== 'function') throw new Error('fetch implementation unavailable');
  const logger = log ?? { info() {}, warn() {}, error() {} };

  const secrets = [cfg.serviceRoleKey];
  const say = (msg) => logger.info(redact(msg, secrets));
  const summary = {
    mode,
    ok: true,
    planned: [],
    usersCreated: [],
    usersReused: [],
    profilesCreated: [],
    profilesReused: [],
    signInVerified: [],
    failures: [],
  };

  const request = async (method, pathname, body) => {
    const res = await f(`${cfg.url}${pathname}`, {
      method,
      headers: {
        apikey: cfg.serviceRoleKey,
        Authorization: `Bearer ${cfg.serviceRoleKey}`,
        'Content-Type': 'application/json',
        ...(method === 'POST' ? { Prefer: 'return=representation' } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return res;
  };

  const fail = (email, reason) => {
    summary.ok = false;
    summary.failures.push({ email, reason: redact(reason, secrets) });
    say(`FAILED ${email}: ${redact(reason, secrets)}`);
  };

  const requireOk = async (res, context) => {
    if (res.ok) return res;
    const t = await (res.text ? res.text() : Promise.resolve('')).catch(() => '');
    throw new Error(`${context} -> HTTP ${res.status}: ${String(t).slice(0, 200)}`);
  };

  for (const ident of IDENTITIES) {
    try {
      // 1. existing auth user at the fixed UUID?
      const userRes = await request('GET', `/auth/v1/admin/users/${ident.id}`);
      let existingUser = null;
      if (userRes.status === 404) {
        existingUser = null;
      } else {
        const userOk = await requireOk(userRes, `admin get ${ident.email}`);
        existingUser = await userOk.json();
      }

      if (existingUser && existingUser.email !== ident.email) {
        throw new Error(
          `unexpected existing account at fixed UUID (email ${existingUser.email}) — refusing to modify`,
        );
      }

      // 2. profile state
      const profRes = await request(
        'GET',
        `/rest/v1/profiles?id=eq.${ident.id}&select=id,role,is_synthetic,display_name`,
      );
      const profOk = await requireOk(profRes, `profile get ${ident.email}`);
      const profRows = await profOk.json();

      if (profRows.length > 1) {
        throw new Error('unexpected duplicate profile rows — refusing to modify');
      }
      const existingProfile = profRows[0] ?? null;
      if (existingProfile) {
        if (existingProfile.role !== ident.role || existingProfile.is_synthetic !== true) {
          throw new Error(
            'unexpected existing profile state (role/is_synthetic mismatch) — refusing to modify',
          );
        }
      }

      // 3. plan or execute
      if (mode === 'dry-run') {
        const actions = [];
        if (!existingUser) actions.push('create-user');
        if (!existingProfile) actions.push('create-profile');
        if (actions.length === 0) {
          summary.usersReused.push(ident.email);
          summary.profilesReused.push(ident.email);
          say(`DRY-RUN reuse ${ident.email} (user+profile already correct)`);
        } else {
          summary.planned.push({ email: ident.email, actions });
          say(`DRY-RUN plan ${ident.email}: ${actions.join(' + ')}`);
        }
        continue;
      }

      // execute mode
      let password = null;
      if (!existingUser) {
        password = randomBytes(24).toString('base64url');
        secrets.push(password);
        const createRes = await request('POST', '/auth/v1/admin/users', {
          id: ident.id,
          email: ident.email,
          password,
          email_confirm: true,
        });
        await requireOk(createRes, `admin create ${ident.email}`);
        summary.usersCreated.push(ident.email);
        say(`created user ${ident.email}`);
      } else {
        summary.usersReused.push(ident.email);
        say(`reused user ${ident.email}`);
      }

      if (!existingProfile) {
        const profCreate = await request('POST', '/rest/v1/profiles', {
          id: ident.id,
          role: ident.role,
          display_name: ident.displayName,
          is_active: true,
          is_synthetic: true,
        });
        await requireOk(profCreate, `profile create ${ident.email}`);
        summary.profilesCreated.push(ident.email);
        say(`created profile ${ident.email} (role=${ident.role}, synthetic=true)`);
      } else {
        summary.profilesReused.push(ident.email);
        say(`reused profile ${ident.email}`);
      }

      if (password) {
        const loginRes = await f(`${cfg.url}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            apikey: cfg.serviceRoleKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: ident.email, password }),
        });
        await requireOk(loginRes, `sign-in verify ${ident.email}`);
        summary.signInVerified.push(ident.email);
        say(`sign-in verified ${ident.email}`);
        // password intentionally not stored anywhere; only kept in the
        // in-memory redaction list for the remainder of this run.
      }
    } catch (err) {
      fail(ident.email, err?.message ?? String(err));
      break; // fail closed: stop processing further identities
    }
  }

  return summary;
}

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

async function main(argv) {
  const allowed = new Set(['--dry-run', '--execute']);
  if (argv.length !== 1 || !allowed.has(argv[0])) {
    console.error('usage: node scripts/provision-synthetic.mjs --dry-run | --execute');
    return 2;
  }
  const fileEnv = await readDotEnv();
  const url = process.env.SUPABASE_URL || fileEnv.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY;
  try {
    verifyConfig(url, key);
  } catch (err) {
    console.error(redact(`configuration error: ${err.message}`, [key]));
    return 1;
  }
  const summary = await provision({
    url,
    serviceRoleKey: key,
    mode: argv[0] === '--execute' ? 'execute' : 'dry-run',
    fetchImpl: globalThis.fetch,
    log: { info: (m) => console.log(m), warn: (m) => console.warn(m), error: (m) => console.error(m) },
  });
  console.log(JSON.stringify(summary, null, 2));
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
