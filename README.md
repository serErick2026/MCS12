# School Safety Intelligence and Notification System

**Development of a Community-Driven School Safety Intelligence and Notification
System Using Incident Correlation and Multi-Criteria Risk Assessment**

Senior High School research prototype. Current phase: **project
initialization only** — no application modules are implemented yet.

> This README replaced the placeholder README created during repository setup.
> The repository name is `MCS12`; the project name above is the approved title.

## Technology stack

| Layer | Choice |
| --- | --- |
| Frontend | HTML5, CSS3, vanilla JavaScript (ES modules) |
| Hosting | Cloudflare Pages (free tier) |
| Backend API | Cloudflare Pages Functions (Workers runtime) |
| Database | Supabase PostgreSQL (free tier) |
| Authentication | Supabase Auth (free tier) |
| Version control | Git + GitHub |
| Algorithms | JavaScript modules |

No paid services, paid APIs, paid libraries, or subscriptions.

## Project structure

```text
.
├── docs/                    approved project documents (placeholders)
├── public/                  deployable static site (Pages build output dir)
│   ├── index.html           landing page
│   ├── assets/              static assets
│   ├── manifest.webmanifest PWA manifest
│   ├── src/                 BUILD ARTIFACT - copied from /src (gitignored)
│   └── config.js            BUILD ARTIFACT - generated from .env (gitignored)
├── src/                     application source (browser ES modules)
│   ├── app.js
│   ├── config/env.js
│   ├── services/            supabase.js, api.js
│   ├── modules/             empty slots for approved future modules
│   └── styles/main.css
├── functions/api/health.js  Pages Function -> GET /api/health
├── scripts/build.mjs        copies src/ and writes public/config.js
├── supabase/                config.toml, migrations/, seed.sql
├── tests/                   node:test checks
├── .env.example             environment variable documentation
├── wrangler.toml            Cloudflare Pages configuration
├── package.json             scripts + wrangler dev dependency
└── AGENTS.md                rules for AI-assisted development
```

`public/` is the only directory uploaded to Cloudflare Pages. Because
`src/` and generated `config.js` must ship with the site, the build step
copies them into `public/` (both copies are gitignored).

## Prerequisites

- Node.js 20 or newer
- npm
- A free [Cloudflare](https://dash.cloudflare.com) account (deployment only)
- A free [Supabase](https://supabase.com) project (database/auth only)
- Supabase CLI (optional, for local database work)

## Local setup

```bash
git clone https://github.com/serErick2026/MCS12.git
cd MCS12
npm install
copy .env.example .env      # Windows: copy .env.example .env (use: cp on macOS/Linux)
# edit .env with your Supabase values (placeholders work for a first run)
npm run build
npm run dev
```

`npm run dev` builds, then serves `public/` with local Pages Functions on
http://localhost:8788. After editing files in `src/`, re-run `npm run build`
(the dev server does not watch `src/`).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run build` | Copy `src/` into `public/src/` and generate `public/config.js` from `.env` / process env |
| `npm run dev` | Build, then run a local Cloudflare Pages server with Functions |
| `npm test` | Run `node --test` checks (config, placeholders, secret scan) |
| `npm run deploy` | Build and deploy to Cloudflare Pages — **manual, never run automatically** |

## Environment variables

Documented in `.env.example`. Copy it to `.env` (gitignored).

| Variable | Used by | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | Browser (via generated `public/config.js`) | Supabase project URL |
| `SUPABASE_ANON_KEY` | Browser (via generated `public/config.js`) | Publishable/anon key — safe for clients |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend secrets only | Privileged key; never shipped to the browser |

On Cloudflare Pages, set these as **build-time environment variables** in the
dashboard (`Settings > Environment variables`) so `scripts/build.mjs` can bake
them into `public/config.js`. Use **Functions secrets** for any Worker-side
secrets. Local equivalents: `.env` for the build, `.dev.vars` for Functions.

## Cloudflare setup (manual)

1. Create a Cloudflare account (free tier).
2. Create a Pages project (e.g. `school-safety-intelligence`), connect the
   GitHub repository `serErick2026/MCS12`, or use `npm run deploy` with wrangler.
3. Build command: `npm run build` · Build output directory: `public`.
4. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` as environment variables.
5. Deployment is manual — no automatic deploys are configured.

## Supabase setup (manual)

1. Create a free Supabase project.
2. Copy the project URL and **anon/publishable** key into `.env`.
3. Enable Row Level Security before adding any application table.
4. Add approved schema migrations to `supabase/migrations/` and apply them
   (`supabase db push` or the SQL editor). Never run destructive SQL.
5. Keep the service role key in backend secrets only.

## Security rules

- Only the publishable/anon key may appear in browser code.
- No service role keys, database passwords, or tokens in the repository.
- RLS required on every application table; no permissive production policies.
- `.env` and `.dev.vars` are gitignored and must never be committed.
- Synthetic sample data only — never real learner or personal data.

## License

See repository `LICENSE` status — pending.
