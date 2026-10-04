# Database Design Change Log (PROPOSED)

**Status:** Draft — proposed 2026-10-04, documents the transition from
Approved Design Baseline v1.0 to candidate v1.1. **NOT APPROVED.**
**Companion:** `docs/database-design-v1.1-candidate.md`.

## 1. Change classification summary

| ID | Change | Classification |
|---|---|---|
| EX-01 | Notification recipient authorization / delivery visibility | **Candidate-accepted** (pending human approval) |
| EX-02 | Backend-controlled report creation, correction, withdrawal | **Candidate-accepted** (pending human approval) |
| EX-03 | Report field editability and lifecycle restrictions | **Candidate-accepted** (pending human approval) |
| EX-04 | Migration tooling and local verification | **Conditional** (dev-tooling approval required) |
| EX-05 | Environment boundaries | **Conditional / Deferred** (real-data phase only) |
| EX-06 | Complete risk-threshold configuration requirement | **Candidate-accepted** (pending human approval) |
| EX-07 | Reference-data confirmation requirements | **Deferred** (institutional) |
| EX-08 | Architecture documentation dependency | **Deferred** (non-blocking) |
| EX-09 | Synthetic authentication-user provisioning | **Conditional** (local accepted as candidate; shared pending human decision) |

**No change is approved yet.** "Candidate-accepted" = proposed resolutions
ready for approval decision; "Conditional" = adopted only when the stated
condition is met.

## 2. Detailed changes

### EX-01 — Notification recipient authorization and delivery visibility
| Aspect | Detail |
|---|---|
| Previous design (v1.0) | `notifications` SELECT: `created_by = auth.uid()` OR administrator (note claimed "members read via recipient rows" but no member predicate existed); `notification_recipients` SELECT: `recipient_id = auth.uid()` OR administrator. |
| Proposed revision | Member SELECT predicate: `id IN (SELECT notification_id FROM notification_recipients WHERE recipient_id = auth.uid() AND delivered_at IS NOT NULL) AND status = 'sent'`; recipient rows visible only after `delivered_at IS NOT NULL`; admin exempt. Thus member access requires recipient membership **and** sent status **and** delivery availability. |
| Clarification (authorized docs-only, 2026-10-04) | **Availability, viewing, and acknowledgment are distinct concepts.** *Availability:* `notification_recipients.delivered_at` = when content becomes accessible to the authorized recipient; availability never implies viewing or acknowledgment. *Viewing:* `notification_acknowledgments.read_at` records the actual viewing event; recorded separately; never automatically implies acknowledgment. *Acknowledgment:* `notification_acknowledgments.acknowledged_at` records an explicit action; never inferred from delivery or viewing. *Epistemic limit:* no database timestamp proves a person understood a message. Notification `status` (workflow) and recipient `delivered_at` (per-recipient availability) remain distinct; acknowledgment rows stay bound to the exact `recipient_row_id` (unique FK) preserving recipient+notification association. Approval, sending, audit, and RLS requirements unchanged. |
| Rationale | Fulfills the v1.0 intent; prevents enumeration of pending undelivered notifications; prevents content leakage of drafts/pending/approved-not-sent; makes availability/viewing/acknowledgment semantics explicit and non-epistemic. |
| Security/privacy impact | Members cannot infer upcoming notifications or read undelivered content; no cross-member access; admin path unchanged; no observational claim is made about comprehension. |
| Verification | T-04 extensions: draft/pending/approved-not-sent read blocked; own sent **delivered** read OK; other-member sent blocked; recipient row hidden pre-`delivered_at`; content inaccessible when `delivered_at` unset even if `status='sent'`; `read_at` may exist without `acknowledged_at` (viewing ≠ acknowledgment); acknowledgment always tied to the correct recipient row and its notification (join integrity); status vs delivery state remain independently asserted. |
| Approval status | Candidate-accepted — **human approval required before M6 drafting**. |

### EX-02 — Backend-controlled report creation, correction, withdrawal
| Aspect | Detail |
|---|---|
| Previous design (v1.0) | §12 client-direct "create own report" and "correct/withdraw own submitted report" via RLS; `reports` had client INSERT/UPDATE policies; audit events lacked creation. |
| Proposed revision | All report writes move to backend Functions (`service_role`); `reporter_id` from JWT; RLS removes client INSERT/UPDATE/DELETE policies; audited events add `report.created`, `report.updated`, `report.withdrawn`. |
| Rationale | Closes the audit gap ("coverage by construction"); single enforcement point for authorship; honors D-03 (authenticated-only). |
| Security/privacy impact | Complete reporting-lifecycle audit; client write surface removed; reporter identity cannot be spoofed; minor latency cost. |
| Verification | Client INSERT/UPDATE on `reports` fails (T-01/T-04); backend create/edit/withdraw succeed and write audit rows; `reporter_id` mismatch rejected. |
| Approval status | Candidate-accepted — **human approval required before M3/M7 drafting**. |

### EX-03 — Report field editability and lifecycle restrictions
| Aspect | Detail |
|---|---|
| Previous design (v1.0) | "UPDATE own rows while `status='submitted'`, allowed columns only" — allowlist undefined. |
| Proposed revision | Editable (while `submitted`): `description`, `category_id`, `location_id`, `occurred_at`, `claimed_severity`, `is_anonymous`, `latitude`, `longitude`. Never editable: `reporter_id`, `status`, `is_synthetic`, timestamps. Withdrawal = backend transition. |
| Rationale | Removes ambiguity; prevents status/identity tampering. |
| Security/privacy impact | Author cannot alter status or identity; anonymity togglable only pre-review. |
| Verification | Allowlist edit tests; status/identity edit rejection; post-`submitted` edit rejection (T-04). |
| Approval status | Candidate-accepted — **human approval required before M3 drafting**. |

### EX-04 — Migration tooling and local verification
| Aspect | Detail |
|---|---|
| Previous design (v1.0) | No tooling decision; plan flagged A-04. |
| Proposed revision | Supabase CLI local stack for migrations/tests; plain `.sql` in `supabase/migrations/`; SQL assertion scripts in `supabase/tests/`; repository node test extended (RLS coverage scan, zero `anon` policies). |
| Rationale | Standard free-tier path; versioned reviewable artifacts; consistent with existing `config.toml`/`seed.sql`. |
| Security/privacy impact | Local-only until authorized; no credentials in repo; auditable migration trail. |
| Verification | `supabase db reset` reaches M8 clean; idempotent re-runs. |
| Approval status | **Conditional** — dev-tooling addition requires approval; needed before G-2 (apply), not before drafting. |

### EX-05 — Development, preview, and production environment boundaries
| Aspect | Detail |
|---|---|
| Previous design (v1.0/plan) | One Supabase project for preview+production; risk R-05. |
| Proposed revision | Local CLI stack isolated; shared preview/prod project tolerated **only while synthetic**; real-data phase requires explicit topology decision (separate project vs disabled preview vs accepted risk). |
| Rationale | Free-tier constraint; isolates until real data exists. |
| Security/privacy impact | Prevents real-data bleed; residual risk limited to synthetic phase. |
| Verification | Environment smoke test; fixture guard (no non-synthetic rows in shared env). |
| Approval status | **Conditional / Deferred** — real-data phase only; `[HUMAN DECISION REQUIRED]` for topology. |

### EX-06 — Complete risk-threshold configuration requirement
| Aspect | Detail |
|---|---|
| Previous design (v1.0) | `risk_level` NOT NULL; thresholds content deferred; no write-time validation possible with empty tables. |
| Proposed revision | Assessment writes rejected until `risk_thresholds` holds the full four-band configuration; DB guard mirrors backend check; `risk_level` stays NOT NULL. |
| Rationale | No provisional classifications; risk levels only ever reflect approved methodology. |
| Security/privacy impact | No misleading risk classifications stored; no later repair data. |
| Verification | Insert rejected with empty thresholds; accepted + band-validated after config; `is_current` swaps re-validated (T-04). |
| Approval status | Candidate-accepted — **human approval required before M5 drafting**. |

### EX-07 — Reference-data confirmation requirements
| Aspect | Detail |
|---|---|
| Previous design (v1.0) | Values `[CONFIRM]`, generic placeholders, no institutional claim. |
| Proposed revision | Placeholder seeding local-stack only; shared-env seeding after institutional O-01 confirmation. |
| Rationale | No fabricated official values in shared environments. |
| Security/privacy impact | No invented school names live; dev unaffected. |
| Verification | Fixture guard: zero `[CONFIRM]` values outside local; G-6 checklist. |
| Approval status | **Deferred** — institutional confirmation. |

### EX-08 — Architecture documentation dependency
| Aspect | Detail |
|---|---|
| Previous design | `system-architecture.md` placeholder; database design approved independently. |
| Proposed revision | Architecture content required **before application modules** (already gated); not a blocker for schema stages. |
| Rationale | Modules depend on architecture; schema drafting does not. |
| Security/privacy impact | None directly; prevents unfounded assumptions later. |
| Verification | Readiness-checklist item. |
| Approval status | **Deferred** — institutional content; non-blocking. |

### EX-09 — Synthetic authentication-user provisioning
| Aspect | Detail |
|---|---|
| Previous design (v1.0) | "Backend admin flow" — mechanism unspecified; credentials never committed. |
| Proposed revision | Local-stack provisioning script; runtime credentials; deterministic, idempotent, throwaway passwords verified and discarded; shared-env mechanism requires separate human decision. |
| Rationale | Limits blast radius; keeps repo credential-free; reproducible fixtures. |
| Security/privacy impact | No repo credentials; `.invalid` accounts; local-only. |
| Verification | Script idempotency; local sign-in; escalation still blocked (T-03); no partial credentials on failure. |
| Approval status | **Conditional** — local candidate-accepted; shared path `[HUMAN DECISION REQUIRED]`. |

## 3. Human decisions still required (not inventable)

1. **Approval of the v1.1 candidate surface** (EX-01, EX-02, EX-03, EX-06) —
   drafting blockers.
2. **EX-04** — Supabase CLI dev-tooling approval.
3. **EX-05** — real-data environment topology.
4. **EX-09** — shared-environment synthetic-user credential mechanism.
5. **EX-07** — institutional confirmation of reference values (O-01).

## 4. Explicitly preserved (not amended)

All v1.0 decisions not listed above: D-01…D-14; O-04…O-10; role model and
permission matrix; community-feed allowlist (O-09); append-only audit
posture and its owner-level limitation; conflict analysis C-01…C-07;
one-school scope; migration sequence; synthetic-only rules; retention
pending institutional approval.
