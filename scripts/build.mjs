import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const srcDir = path.join(root, 'src');

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

function escape(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

const fileEnv = await readDotEnv();
const supabaseUrl = process.env.SUPABASE_URL || fileEnv.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || fileEnv.SUPABASE_ANON_KEY || '';

await rm(path.join(publicDir, 'src'), { recursive: true, force: true });
await cp(srcDir, path.join(publicDir, 'src'), { recursive: true });

await mkdir(publicDir, { recursive: true });
await writeFile(
  path.join(publicDir, 'config.js'),
  [
    'window.__APP_CONFIG__ = {',
    `  SUPABASE_URL: "${escape(supabaseUrl)}",`,
    `  SUPABASE_ANON_KEY: "${escape(supabaseAnonKey)}"`,
    '};',
    '',
  ].join('\n'),
  'utf8'
);

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[build] Supabase values missing - using empty placeholders. Copy .env.example to .env.');
}

console.log('[build] public/src and public/config.js generated.');
