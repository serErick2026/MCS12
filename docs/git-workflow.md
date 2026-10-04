# Git Workflow

**Status:** Approved — Phase 2 task, 2026-10-04.
**Scope:** Branching, committing, review, and merge rules for MCS12. Application
modules remain approval-gated per `development-roadmap.md`.

## 1. Branch model

- `main` — the stable production branch. It is connected to Cloudflare Pages:
  the GitHub `main` branch drives the production deployment.
- `feature/*` — approved new functionality (example:
  `feature/database-schema`).
- `fix/*` — bug fixes (example: `fix/health-endpoint-timestamp`).
- No separate `develop` branch for now.
- Rule: all feature work must be reviewed before merging into `main`.

## 2. Branch naming conventions

- Format: `<type>/<short-kebab-case-description>`.
- Types in use: `feature`, `fix`. New types require approval.
- One concern per branch; keep the description short and specific.

## 3. Branch creation procedure

Branch creation requires explicit human approval first. Then:

```bash
git fetch origin
git switch main
git pull origin main
git switch -c feature/<name>
```

- Always branch from an up-to-date `main`.
- Do not create, rename, delete, or push branches without explicit approval.

## 4. Commit message conventions

- Imperative summary line, concise, matching existing history style
  (`Add …`, `Move …`, `Tighten …`, `Support …`).
- Optional scope prefix for housekeeping commits (`chore:`) as used in
  existing history.
- Body explains what and why when not obvious from the summary.
- Never include secrets, tokens, keys, or `.env` content in messages or diffs.
- Keep commits focused so they can be reviewed and reverted independently.

## 5. Pull request workflow

1. Push the approved feature/fix branch to `origin` (push requires approval).
2. Open a pull request against `main` on GitHub.
3. Author self-reviews the diff and confirms checks pass:
   `npm test` and `npm run build` (report results in the PR; CI is not
   configured yet).
4. A human reviewer approves. The AI agent never approves or merges its own
   pull request.
5. Address feedback with follow-up commits; avoid force-pushing a branch that
   has already been reviewed.
6. Merge only after explicit approval.

## 6. Testing and review requirements

- `npm test` and `npm run build` must pass before a PR is requested.
- The repository secret-scan test must pass; no secrets may enter history.
- **Database migrations and RLS policies require explicit human review and
  approval before merge.** They are security-critical and may not be merged on
  the basis of automated checks alone.
- Changes to `functions/`, `wrangler.toml`, or environment-variable handling
  should be flagged for extra reviewer attention.
- No application code, database schema, or deployment-configuration changes
  outside an approved PR.

## 7. Merge and release procedure

- Merge approved PRs into `main` with a merge commit or squash commit
  (reviewer's choice, noted in the PR).
- **Merging into `main` may trigger a production deployment:** GitHub `main`
  is connected to Cloudflare Pages, and every push to `main` starts an
  automatic production build.
- After merge/deploy, verify:
  - `GET /api/health` returns `status: ok`
  - Landing page loads (HTTP 200)
- Manual fallback deployment exists (`npm run deploy`) but must never be run
  unprompted.

## 8. Rollback considerations

- Preferred: fix forward or `git revert` the offending commit through the
  normal `fix/*` → PR → review flow.
- For urgent production issues: roll back to the previous deployment from the
  Cloudflare Pages dashboard (instant, no git change), then land a proper
  revert afterwards.
- Never force-push `main`; never rewrite or delete `main` history.
- Record what was rolled back and why in the follow-up PR.

## 9. Hard rules

- No branch may be created, merged, deleted, or pushed without explicit
  approval.
- No secrets, credentials, or tokens in commits, branches, messages, or PRs.
- No force-pushes; no direct pushes to `main` outside the approved flow.
- Feature branches may not modify deployment configuration or database schema
  without the reviews required in section 6.
