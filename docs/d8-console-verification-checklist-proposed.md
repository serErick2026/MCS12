# D-8 — Free-Tier Console Verification Checklist (PREPARED, NOT EXECUTED)

**Status:** PREPARED 2026-10-05 under the M3 execution authorization.
These are manual checks in the Supabase Dashboard for project **MCS12**
(`idytcuiecducelmwqrbo`) that cannot be verified from CLI/API alone.
Execution is a researcher-operated console session (screen access is
yours; I only need the pass/fail answers). Nothing here modifies
configuration unless explicitly noted.

## Supabase Dashboard

- [ ] **API keys page** — shows the publishable/anon key and the secret
      (service-role) key; confirm the *old* service-role key is gone
      after SEC-01 rotation.
- [ ] **Account → Access tokens** — confirm the previously exposed
      `sbp_*` token(s) are **revoked** and replaced (SEC-01).
- [ ] **Authentication → Users** — exactly **5** users, all
      `@school-safety.invalid`, all email-confirmed, no unexpected
      providers or additional accounts.
- [ ] **Table editor** — **6** tables (`profiles`, `report_categories`,
      `locations`, `risk_criteria`, `risk_thresholds`, `reports`);
      each shows **RLS enabled**; `reports` shows **1** policy; ref
      tables show 4 policies total; `profiles` shows 2.
- [ ] **Table editor data view** — `report_categories`, `locations`,
      `risk_criteria`, `risk_thresholds`, `reports` all **empty**
      (0 rows); `profiles` has **5** rows.
- [ ] **Database → Logs / API logs** — no recurring errors in last 24h
      (spot-check: 401s from anon probes are expected).
- [ ] **Database → Backups** — confirm free-tier backup schedule shown
      and note the retention stated by the console.
- [ ] **Settings → General** — confirm project region **Tokyo
      (ap-northeast-1)** and project name **MCS12**.

## Cloudflare Dashboard (Pages project `school-safety-intelligence`)

- [ ] Production + preview still bound and healthy (last deploy
      successful; no failed builds since `0672b52`-era deploys).
- [ ] Environment variables show only the approved public values
      (`SUPABASE_URL`, anon key); **no service-role or account tokens**
      present in Pages settings.

## Answers to record

| # | Item | Pass/Fail | Note |
|---|---|---|---|
| 1 | API keys reflect rotation | | |
| 2 | sbp_* tokens revoked | | |
| 3 | exactly 5 synthetic users | | |
| 4 | 6 tables, RLS on, policy counts | | |
| 5 | ref/reports tables empty; profiles = 5 | | |
| 6 | no recurring console errors | | |
| 7 | backups schedule visible | | |
| 8 | region/name correct | | |
| 9 | Pages bindings healthy | | |
| 10 | Pages env contains no secrets | | |
