import { spawn } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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

function quote(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

const fileEnv = await readDotEnv();
const supabaseUrl = process.env.SUPABASE_URL || fileEnv.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || fileEnv.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[deploy] SUPABASE_URL / SUPABASE_ANON_KEY missing in .env - aborting.');
  process.exit(1);
}

const rootToml = await readFile(path.join(root, 'wrangler.toml'), 'utf8');
const projectName = rootToml.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
const compatibilityDate = rootToml.match(/^compatibility_date\s*=\s*"([^"]+)"/m)?.[1];
if (!projectName || !compatibilityDate) {
  console.error('[deploy] Could not read name/compatibility_date from wrangler.toml.');
  process.exit(1);
}

const tempDir = await mkdtemp(path.join(tmpdir(), 'wr-deploy-'));
const publicDir = path.join(root, 'public').replace(/\\/g, '/');

try {
  const tempToml = [
    `name = ${quote(projectName)}`,
    `compatibility_date = ${quote(compatibilityDate)}`,
    `pages_build_output_dir = ${quote(publicDir)}`,
    '',
    '[vars]',
    `SUPABASE_URL = ${quote(supabaseUrl)}`,
    `SUPABASE_ANON_KEY = ${quote(supabaseAnonKey)}`,
    '',
  ].join('\n');

  await writeFile(path.join(tempDir, 'wrangler.toml'), tempToml, 'utf8');
  await cp(path.join(root, 'functions'), path.join(tempDir, 'functions'), { recursive: true });

  const code = await new Promise((resolve) => {
    const child = spawn('npx.cmd', ['wrangler', 'pages', 'deploy', '--cwd', tempDir], {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
      shell: true,
    });
    child.on('exit', (exitCode) => resolve(exitCode ?? 1));
  });

  if (code !== 0) {
    console.error(`[deploy] wrangler exited with code ${code}`);
    process.exit(code);
  }

  console.log(`[deploy] Deployed ${projectName} with production env vars from .env.`);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
