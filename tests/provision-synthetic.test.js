import test from 'node:test';
import assert from 'node:assert/strict';
import {
  provision,
  verifyConfig,
  redact,
  EXPECTED_PROJECT_REF,
  IDENTITIES,
} from '../scripts/provision-synthetic.mjs';

const URL_OK = `https://${EXPECTED_PROJECT_REF}.supabase.co`;
const KEY = 'SECRET-KEY-ABC123-MOCK';

function recorder(logLines = []) {
  const calls = [];
  const log = { info: (m) => logLines.push(String(m)), warn: (m) => logLines.push(String(m)), error: (m) => logLines.push(String(m)) };
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    const method = (init.method || 'GET').toUpperCase();
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    return route(url, method, body, init);
  };
  return { calls, log, fetchImpl };
}

// scenario router: default = fresh target (all creates succeed)
let scenario = null;
function setScenario(s) {
  scenario = s;
}
function json(status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}
function route(url, method, body, init) {
  if (scenario) return scenario(url, method, body, init);
  // fresh-state default
  if (method === 'GET' && /\/auth\/v1\/admin\/users\//.test(url)) return json(404, { message: 'not found' });
  if (method === 'POST' && /\/auth\/v1\/admin\/users$/.test(url)) return json(201, { id: body.id, email: body.email });
  if (method === 'GET' && url.includes('/rest/v1/profiles')) return json(200, []);
  if (method === 'POST' && url.endsWith('/rest/v1/profiles')) return json(201, [body]);
  if (method === 'POST' && url.includes('/auth/v1/token')) return json(200, { access_token: 'mock', user: {} });
  return json(500, { message: `no handler for ${method} ${url}` });
}

test('verifyConfig: missing url or key fails closed', () => {
  assert.throws(() => verifyConfig('', KEY), /SUPABASE_URL/);
  assert.throws(() => verifyConfig(URL_OK, ''), /SUPABASE_SERVICE_ROLE_KEY/);
  assert.throws(() => verifyConfig(null, KEY), /SUPABASE_URL/);
  assert.throws(() => verifyConfig(URL_OK, null), /SUPABASE_SERVICE_ROLE_KEY/);
});

test('verifyConfig: wrong project reference rejected', () => {
  assert.throws(() => verifyConfig('https://evilproj.supabase.co', KEY), /target mismatch/);
  assert.throws(() => verifyConfig('http://idytcuiecducelmwqrbo.supabase.co', KEY), /https/);
  assert.throws(() => verifyConfig('not-a-url', KEY), /valid URL/);
  const ok = verifyConfig(URL_OK, KEY);
  assert.equal(ok.url, URL_OK);
});

test('provision: invalid configuration fails before any API call', async () => {
  const r = recorder();
  await assert.rejects(provision({ url: 'https://evil.supabase.co', serviceRoleKey: KEY, mode: 'execute', fetchImpl: r.fetchImpl, log: r.log }), /target mismatch/);
  assert.equal(r.calls.length, 0);

  const r2 = recorder();
  await assert.rejects(provision({ url: URL_OK, serviceRoleKey: '', mode: 'execute', fetchImpl: r2.fetchImpl, log: r2.log }), /SUPABASE_SERVICE_ROLE_KEY/);
  assert.equal(r2.calls.length, 0);

  const r3 = recorder();
  await assert.rejects(provision({ url: URL_OK, serviceRoleKey: KEY, mode: 'sideways', fetchImpl: r3.fetchImpl, log: r3.log }), /invalid mode/);
  assert.equal(r3.calls.length, 0);
});

test('allowlist: exactly five frozen synthetic identities in approved namespace', () => {
  assert.equal(IDENTITIES.length, 5);
  assert.ok(Object.isFrozen(IDENTITIES));
  const allowedRoles = new Set(['administrator', 'safety_officer', 'member', 'viewer']);
  for (const id of IDENTITIES) {
    assert.ok(Object.isFrozen(id));
    assert.match(id.email, /^synthetic\.[a-z-]+@school-safety\.invalid$/);
    assert.match(id.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.ok(allowedRoles.has(id.role));
  }
  const emails = IDENTITIES.map((i) => i.email);
  assert.equal(new Set(emails).size, 5);
});

test('dry-run: plans only, zero write calls, no password sent', async () => {
  const r = recorder();
  const summary = await provision({ url: URL_OK, serviceRoleKey: KEY, mode: 'dry-run', fetchImpl: r.fetchImpl, log: r.log });
  assert.equal(summary.ok, true);
  assert.equal(summary.planned.length, 5);
  assert.equal(summary.usersCreated.length, 0);
  const methods = new Set(r.calls.map((c) => c.method));
  assert.deepEqual([...methods].sort(), ['GET']);
  const bodies = r.calls.filter((c) => c.body);
  assert.equal(bodies.length, 0);
});

test('execute on fresh target: creates exactly five users + five profiles, no deletes/updates', async () => {
  const r = recorder();
  const summary = await provision({ url: URL_OK, serviceRoleKey: KEY, mode: 'execute', fetchImpl: r.fetchImpl, log: r.log });
  assert.equal(summary.ok, true);
  assert.equal(summary.usersCreated.length, 5);
  assert.equal(summary.profilesCreated.length, 5);
  assert.equal(summary.signInVerified.length, 5);
  assert.equal(summary.failures.length, 0);
  const methods = new Set(r.calls.map((c) => c.method));
  assert.ok(!methods.has('DELETE') && !methods.has('PATCH') && !methods.has('PUT'));
  const creates = r.calls.filter((c) => c.method === 'POST' && c.url.endsWith('/rest/v1/profiles'));
  assert.equal(creates.length, 5);
  for (const c of creates) assert.equal(c.body.is_synthetic, true);
  for (const c of r.calls.filter((c) => c.method === 'POST' && /\/admin\/users$/.test(c.url))) {
    assert.ok(IDENTITIES.some((i) => i.id === c.body.id && i.email === c.body.email));
    assert.ok(!JSON.stringify(c.body).includes(KEY));
  }
});

test('duplicate execution: correct existing state is reused with zero writes', async () => {
  setScenario((url, method, body) => {
    if (method === 'GET' && /\/auth\/v1\/admin\/users\//.test(url)) {
      const uuid = url.split('/').pop();
      const ident = IDENTITIES.find((i) => i.id === uuid);
      return json(200, { id: uuid, email: ident.email });
    }
    if (method === 'GET' && url.includes('/rest/v1/profiles')) {
      const uuid = url.match(/id=eq\.([0-9a-f-]+)/)[1];
      const ident = IDENTITIES.find((i) => i.id === uuid);
      return json(200, [{ id: uuid, role: ident.role, is_synthetic: true, display_name: ident.displayName }]);
    }
    return json(500, { message: `unexpected ${method} ${url}` });
  });
  const r = recorder();
  const summary = await provision({ url: URL_OK, serviceRoleKey: KEY, mode: 'execute', fetchImpl: r.fetchImpl, log: r.log });
  setScenario(null);
  assert.equal(summary.ok, true);
  assert.equal(summary.usersReused.length, 5);
  assert.equal(summary.profilesReused.length, 5);
  assert.equal(summary.usersCreated.length, 0);
  assert.equal(summary.profilesCreated.length, 0);
  assert.deepEqual([...new Set(r.calls.map((c) => c.method))], ['GET']);
});

test('unexpected existing account at fixed UUID: refuse, stop, no writes', async () => {
  setScenario((url, method) => {
    if (method === 'GET' && /\/auth\/v1\/admin\/users\//.test(url)) return json(200, { email: 'stranger@example.com' });
    return json(500, { message: 'should not be called' });
  });
  const r = recorder();
  const summary = await provision({ url: URL_OK, serviceRoleKey: KEY, mode: 'execute', fetchImpl: r.fetchImpl, log: r.log });
  setScenario(null);
  assert.equal(summary.ok, false);
  assert.equal(summary.failures.length, 1);
  assert.match(summary.failures[0].reason, /refusing to modify/);
  assert.ok(!r.calls.some((c) => c.method === 'POST'));
  assert.ok(!r.calls.some((c) => c.method === 'DELETE'));
});

test('unexpected profile state: refuse modification', async () => {
  setScenario((url, method) => {
    if (method === 'GET' && /\/auth\/v1\/admin\/users\//.test(url)) {
      const uuid = url.split('/').pop();
      const ident = IDENTITIES.find((i) => i.id === uuid);
      return json(200, { id: uuid, email: ident.email });
    }
    if (method === 'GET' && url.includes('/rest/v1/profiles')) {
      const uuid = url.match(/id=eq\.([0-9a-f-]+)/)[1];
      const ident = IDENTITIES.find((i) => i.id === uuid);
      return json(200, [{ id: uuid, role: ident.role === 'viewer' ? 'administrator' : 'viewer', is_synthetic: true }]);
    }
    return json(500, { message: 'should not be called' });
  });
  const r = recorder();
  const summary = await provision({ url: URL_OK, serviceRoleKey: KEY, mode: 'execute', fetchImpl: r.fetchImpl, log: r.log });
  setScenario(null);
  assert.equal(summary.ok, false);
  assert.match(summary.failures[0].reason, /profile state/);
  assert.ok(!r.calls.some((c) => c.method !== 'GET'));
});

test('API error / partial failure: stops at first failure, no cleanup, nonzero summary', async () => {
  let createCount = 0;
  setScenario((url, method, body) => {
    if (method === 'GET' && /\/auth\/v1\/admin\/users\//.test(url)) return json(404, {});
    if (method === 'POST' && /\/admin\/users$/.test(url)) {
      createCount += 1;
      if (createCount === 3) return json(500, { message: 'simulated server error' });
      return json(201, { id: body.id });
    }
    if (method === 'GET' && url.includes('/rest/v1/profiles')) return json(200, []);
    if (method === 'POST' && url.endsWith('/rest/v1/profiles')) return json(201, [body]);
    if (method === 'POST' && url.includes('/auth/v1/token')) return json(200, { access_token: 'mock' });
    return json(500, { message: 'unreachable' });
  });
  createCount = 0;
  const r = recorder();
  const summary = await provision({ url: URL_OK, serviceRoleKey: KEY, mode: 'execute', fetchImpl: r.fetchImpl, log: r.log });
  setScenario(null);
  assert.equal(summary.ok, false);
  assert.equal(summary.failures.length, 1);
  assert.match(summary.failures[0].reason, /HTTP 500/);
  assert.equal(summary.usersCreated.length, 2);
  assert.ok(!r.calls.some((c) => c.method === 'DELETE'));
  assert.ok(!r.calls.some((c) => c.method === 'PATCH' || c.method === 'PUT'));
  const lastCall = r.calls[r.calls.length - 1];
  assert.ok(!r.calls.slice(r.calls.findIndex((c) => c === lastCall) + 1).length);
});

test('secret redaction: service-role key never appears in logs or failure reasons', async () => {
  setScenario((url, method) => {
    if (method === 'GET' && /\/auth\/v1\/admin\/users\//.test(url)) return json(404, {});
    if (method === 'GET' && url.includes('/rest/v1/profiles')) return json(200, []);
    if (method === 'POST' && /\/admin\/users$/.test(url)) {
      return json(500, { message: `bad key ${KEY} supplied` });
    }
    return json(500, { message: 'unreachable' });
  });
  const logLines = [];
  const r = recorder(logLines);
  const summary = await provision({ url: URL_OK, serviceRoleKey: KEY, mode: 'execute', fetchImpl: r.fetchImpl, log: r.log });
  setScenario(null);
  assert.equal(summary.ok, false);
  const allOutput = logLines.join('\n') + JSON.stringify(summary.failures);
  assert.ok(!allOutput.includes(KEY));
  assert.ok(allOutput.includes('[REDACTED]'));
});

test('redact helper: removes every occurrence including password-style secrets', () => {
  const out = redact('pw=AbCdEf0123456789AbCdEf0123456789 key=SECRET', ['AbCdEf0123456789AbCdEf0123456789', 'SECRET']);
  assert.ok(!out.includes('AbCdEf'));
  assert.ok(!out.includes('SECRET'));
  assert.ok(out.includes('[REDACTED]'));
});

test('scripts contain no destructive SQL verbs or hardcoded credential literals', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../scripts/provision-synthetic.mjs', import.meta.url), 'utf8');
  assert.ok(!/\bDROP\s+|\bTRUNCATE\b|DELETE\s+FROM/i.test(src));
  assert.ok(!/sbp_[A-Za-z0-9]{10,}/.test(src));
  assert.ok(!/eyJhbGciOi/.test(src));
  assert.ok(!/postgres:\/\//.test(src));
});
