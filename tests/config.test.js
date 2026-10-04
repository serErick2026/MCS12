import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFile(path.join(root, rel), 'utf8');

test('.env.example documents required variables as placeholders', async () => {
  const env = await read('.env.example');
  const active = env
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .join('\n');

  assert.match(env, /^SUPABASE_URL=/m);
  assert.match(env, /^SUPABASE_ANON_KEY=/m);
  assert.doesNotMatch(env, /eyJ[A-Za-z0-9_-]{20,}/, 'env example must not contain a real JWT');
  assert.doesNotMatch(active, /service_role/i, 'service role key must stay commented out');
});

test('package.json exposes the expected scripts', async () => {
  const pkg = JSON.parse(await read('package.json'));
  for (const script of ['build', 'dev', 'deploy', 'test']) {
    assert.equal(typeof pkg.scripts[script], 'string', `missing script: ${script}`);
  }
  assert.equal(pkg.private, true);
});

test('wrangler.toml targets the Pages build output directory', async () => {
  const toml = await read('wrangler.toml');
  assert.match(toml, /pages_build_output_dir\s*=\s*"public"/);
});

test('no secrets are committed', async () => {
  const files = ['package.json', 'public/index.html', 'src/services/supabase.js', 'functions/api/health.js'];
  for (const file of files) {
    const content = await read(file);
    assert.doesNotMatch(content, /eyJhbGciOi|service_role_key\s*[:=]\s*["'][^"']+["']/i, `${file} appears to contain a secret`);
  }
});

test('wrangler.toml [vars] contains only the publishable anon key', async () => {
  const toml = await read('wrangler.toml');
  assert.doesNotMatch(toml, /service_role\w*\s*=\s*["'][^"']+["']/i, 'service_role key must never appear in wrangler.toml');

  const match = toml.match(/SUPABASE_ANON_KEY\s*=\s*"(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)"/);
  assert.ok(match, 'anon key missing from wrangler.toml [vars]');

  const payload = JSON.parse(Buffer.from(match[1].split('.')[1], 'base64url').toString('utf8'));
  assert.equal(payload.role, 'anon', 'wrangler.toml key must have role=anon');
  assert.equal(payload.iss, 'supabase');
});
