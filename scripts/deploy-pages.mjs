import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function readDotEnv() {
  try {
    const raw = await readFile(path.join(root, '.env'), 'utf8');
    const values = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      values[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
    return values;
  } catch {
    return {};
  }
}

const fileEnv = await readDotEnv();
const deployEnv = { ...process.env };
if (!deployEnv.CLOUDFLARE_API_TOKEN && fileEnv.CLOUDFLARE_API_TOKEN) {
  deployEnv.CLOUDFLARE_API_TOKEN = fileEnv.CLOUDFLARE_API_TOKEN;
}
if (deployEnv.CLOUDFLARE_API_TOKEN) {
  delete deployEnv.CF_API_TOKEN;
}
if (!deployEnv.CLOUDFLARE_ACCOUNT_ID && fileEnv.CLOUDFLARE_ACCOUNT_ID) {
  deployEnv.CLOUDFLARE_ACCOUNT_ID = fileEnv.CLOUDFLARE_ACCOUNT_ID;
}
deployEnv.WRANGLER_SEND_METRICS = 'false';

const code = await new Promise((resolve) => {
  const child = spawn('npx.cmd', ['wrangler', 'pages', 'deploy'], {
    cwd: root,
    stdio: 'inherit',
    env: deployEnv,
    shell: true,
  });
  child.on('exit', (exitCode) => resolve(exitCode ?? 1));
});

if (code !== 0) {
  console.error(`[deploy] wrangler exited with code ${code}`);
  process.exit(code);
}

console.log('[deploy] Deployed school-safety-intelligence (env vars from wrangler.toml [vars]).');
