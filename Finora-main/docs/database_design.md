# Database Design — Smart School FinTech Platform

## Purpose

The authoritative schema reference. An AI coding agent implementing any table, migration, or query should treat this document — not inference from partial context — as the source of truth for field names, types, and relationships.

## Scope

Core entity schema, relationships, enums, and derived/computed fields. Row-Level Security policy is specified in `security.md`; the business logic that operates on this schema is in `business_rules.md`.

---

## Core Entities

### SCHOOL
| Field | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| name | string | |

### USER
| Field | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| role | string | `admin` \| `parent` |
| email | string (nullable for parent, required for admin) | *(nullability changed Phase 11)* — a parent created without an email must still be able to log in via phone, so email can no longer be unconditionally required at the schema level |
| phone | string (nullable for admin, required for parent) | *(added Phase 11)* — E.164 format (e.g. `+91XXXXXXXXXX`). Required for parent role since phone OTP is the primary login channel; admin accounts don't use phone login and may leave this null |
| school_id | uuid (FK → SCHOOL) | |

**Constraint (added Phase 11)**: `CHECK` — a `parent`-role row must have at least one of `email`/`phone` non-null (both may be present; at least one is required for login to be possible at all). An `admin`-role row must have `email` non-null.

### PARENT_LINK
| Field | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK → USER) | |

Linked to STUDENT via `guardian_of` (many-to-many capable — one parent can have multiple linked children, one student can in principle have multiple guardians).

### STUDENT
| Field | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| name | string | |
| class | string | |
| school_id | uuid (FK → SCHOOL) | |
| admission_number | string (nullable) *(added Phase 14)* | school-assigned external ID, unique per `school_id` when present — used by `bulkImportStudents` to detect and skip re-importing an already-existing student rather than creating a duplicate; nullable because not every school necessarily supplies one at single-student creation time |
| status | enum, default `active` *(added Phase 15 — supersedes `is_active`, added Phase 14)* | `active` \| `withdrawn` \| `graduated` \| `transferred` — a boolean couldn't express *why* a student left, which matters for both admin record-keeping and for the `balanceDisposition` decision below. `computeDefaulterScore` and the daily reminder-trigger job both filter on `status = 'active'` — see `business_rules.md` Defaulter Risk Segmentation |
| status_changed_at | timestamp (nullable) *(added Phase 15)* | set when `status` last changed away from `active`; null for a student who has always been active |
| balance_disposition | enum (nullable) *(added Phase 15)* | `write_off` \| `carry_forward` — required by `updateStudentStatus` whenever an outstanding balance exists at the time of a non-`active` status change; null for an active student or one who left with a zero balance. `write_off` triggers a full-remaining-balance `WAIVER` (reuses the existing mechanism, no new financial code path); `carry_forward` leaves the balance collectible but the student is still excluded from the active Defaulter Tracking view, since that view exists to prioritize actionable, current risk, not to be a permanent list of every fee ever owed |

**A `STUDENT` row is never hard-deleted, at any `status` value, while linked `FEE_ASSIGNMENT`/`TRANSACTION` rows exist** — `withdrawn`/`graduated`/`transferred` are all soft states, same pattern as `FEE_TYPE.is_active`; deleting the row would corrupt the historical ledger and audit trail this system exists to preserve. All historical `FEE_ASSIGNMENT`/`TRANSACTION`/`WAIVER`/`PENALTY`/`DEFAULTER_SCORE` data remains fully visible on the Student Profile screen (`ui_ux_specification.md`, added Phase 14) regardless of status.

### AUDIT_LOG
| Field | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| actor_id | uuid (FK → USER) | |
| action | string | e.g. `waiver_applied`, `transaction_reversed`, `cheque_bounced`, `report_exported` *(added Phase 14 — see `business_rules.md` Reporting Logic, NFR-7)* |
| before_state | jsonb | |
| after_state | jsonb | |
| created_at | timestamp | |

Generated automatically by USER actions (`generates` relationship) — every waiver, penalty, reversal, and cheque-bounce event must produce a row here. Recommend enforcing via database trigger, not application code alone, so no code path can bypass logging.

### FEE_TYPE
| Field | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| name | string | |
| category | string | |
| is_active | boolean | |
| gst_treatment | enum | `exempt` \| `taxable` — admin-set, never inferred |
| gst_rate | decimal (nullable) | only relevant when `taxable` |

### FEE_ASSIGNMENT
| Field | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| student_id | uuid (FK → STUDENT) | |
| fee_type_id | uuid (FK → FEE_TYPE) | |
| amount | decimal | |
| due_date | date | |
| amount_paid | decimal (derived) | sum of linked `posted`/cleared transactions — computed on read, never stored directly, so it cannot drift out of sync with the ledger |
| payment_status | enum (derived) | `unpaid` \| `partially_paid` \| `paid` \| `overdue` |
| last_triggered_tier | int | tracks reminder escalation, prevents re-firing the same tier |

### TRANSACTION
| Field | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| fee_assignment_id | uuid (FK) | |
| student_id | uuid (FK) | |
| channel | enum | `upi` \| `cash` \| `cheque` |
| amount | decimal | |
| ref_number | string (nullable) | required for UPI/cheque, used for idempotency and duplicate checks |
| reconciliation_status | enum | `posted` \| `flagged` \| `reversed` \| `cheque_pending` |
| status | string | |
| posted_at | timestamp | |

`reconciliation_status` lives directly on `TRANSACTION` rather than a separate reconciliation table — reconciliation is a live column state, not a downstream batch process. This is a deliberate schema decision, not an oversight; do not "normalize" it into a separate table.

### WAIVER
| Field | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| transaction_id | uuid (FK, nullable) | may attach to a fee assignment context ahead of a transaction, or an existing transaction |
| approved_by | uuid (FK → USER) | **non-nullable** |
| reason | string | **non-nullable** |
| amount | decimal | |

### PENALTY
| Field | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| transaction_id | uuid (FK) | |
| amount | decimal | |
| reason | string | **non-nullable** |

### DEFAULTER_SCORE
| Field | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| student_id | uuid (FK) | |
| risk_level | int | maps to `high` \| `medium` \| `low` per formula in `business_rules.md` |
| computed_reason | string | plain rule-derived explanation, always available regardless of AI narration status |
| computed_at | timestamp | |

### RECEIPT
| Field | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| transaction_id | uuid (FK) | |
| receipt_number | string | sequential, school-scoped |
| format | enum | `a4` \| `thermal` |
| gst_amount | decimal | |
| gst_details | jsonb | derived from `FEE_TYPE.gst_treatment`/`gst_rate` **at time of transaction**, never retroactively recalculated |
| pdf_url | string | Storage path |
| generated_at | timestamp | |

### REMINDER_LOG
| Field | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| fee_assignment_id | uuid (FK) | |
| tier | int | 1, 2, or 3, per the escalation logic in `business_rules.md` §Reminder Strategy — added during Phase 8 remediation; previously implied but not explicitly stored, which made the new `(fee_assignment_id, tier)` uniqueness constraint impossible to express |
| channel | enum | `whatsapp` \| `sms` \| `email` *(added Phase 15)* — `whatsapp`/`sms` always simulated, per Governing Principle #3; `email` is the one narrow exception to that principle's "no real delivery" half, dispatched via Resend when `markReminderSent` is called and the linked parent has an email on file |
| drafted_text | text | Gemini-drafted |
| status | enum | `logged` \| `simulated_sent` (whatsapp/sms — never `delivered`, there is no real delivery for these two channels) \| `sent` \| `failed` *(the latter two added Phase 15, email channel only — `sent` confirms a real Resend dispatch succeeded, `failed` records a real send failure, e.g. bounce/invalid address; both are genuine delivery-attempt outcomes, unlike `simulated_sent`)* |
| dispatch_error | string (nullable) *(added Phase 15)* | Resend's error detail when `status = 'failed'`; null otherwise — surfaced to the admin so a bounced/invalid email is visibly actionable rather than silently retried indefinitely |
| created_at | timestamp | |

### ANOMALY_FLAG
| Field | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| transaction_id | uuid (FK) | |
| expected_amount | decimal | remaining balance at time of payment, not original fee amount |
| received_amount | decimal | |
| flag_reason | string | rule-generated, e.g. `amount_mismatch`, `duplicate_channel_ref` |
| narration | text (nullable) | Gemini-generated, asynchronous, may be absent — UI must fall back to `flag_reason` |
| resolved | boolean | |
| resolved_by | uuid (FK → USER, nullable) | added Phase 8 — an anomaly resolution is as audit-worthy as a waiver/penalty/reversal under this project's own audit-everything-money-adjacent principle; previously the only money-adjacent action without an actor record |
| resolved_at | timestamp (nullable) | |
| resolution_reason | string (nullable) | admin's stated reason for resolving as valid vs. invalid — non-nullable at the point `resolved` is set `true`, nullable only while still open |
| created_at | timestamp | |

### OCR_STAGING
| Field | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| uploaded_by | uuid (FK → USER) | admin only, never parent |
| source_image_url | string | Storage path |
| extracted_fields | jsonb | Gemini's raw extraction |
| confidence | jsonb (nullable) | per-field confidence if available |
| confirmed | boolean | default `false` — **nothing here writes to TRANSACTION until an admin explicitly confirms** |
| confirmed_transaction_id | uuid (FK, nullable) | set only after confirm |
| created_at | timestamp | |

### PUSH_SUBSCRIPTION *(added Phase 9)*
| Field | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK → USER) | works for both roles — the same table serves admin and parent subscriptions, distinguished by `USER.role` via the join, not a separate table per role |
| endpoint | string | the browser-provided push endpoint URL |
| keys_p256dh | string | subscription encryption key, from the browser `PushSubscription` object |
| keys_auth | string | subscription auth secret, from the browser `PushSubscription` object |
| device_label | string (nullable) | optional, e.g. "Chrome on Pixel 8" — helps a user manage multiple subscribed devices from settings |
| created_at | timestamp | |

A user may have multiple rows (one per device/browser they've enabled push on). A send failure against a specific endpoint (expired/revoked subscription — the push service returns 404/410 for this) should delete that row rather than retry indefinitely.

### OFFLINE_SYNC_CONFLICT *(added Phase 10)*
| Field | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| school_id | uuid (FK) | **not device- or user-scoped** — deliberately visible to any admin at the school, not just the one whose device queued the entry; see note below |
| submitted_by | uuid (FK → USER) | the admin whose device originally queued the entry |
| local_id | uuid | the client-generated idempotent ID from the offline queue — preserved here so a retried sync can still be matched/deduplicated even after escalating to a conflict |
| fee_assignment_id | uuid (FK) | |
| channel | enum | `cash` \| `cheque` — never `upi`, per Offline Payment Entry Strategy scope |
| amount | decimal | |
| queued_at | timestamp | when the entry was originally created offline, not when the sync attempt ran |
| conflict_reason | string | e.g. `balance_changed`, `would_overpay` |
| resolved | boolean | |
| resolved_by | uuid (FK → USER, nullable) | |
| resolved_at | timestamp (nullable) | |
| resolution_action | enum (nullable) | `discarded` \| `reentered_adjusted` — non-nullable once `resolved = true` |
| created_at | timestamp | |

**Why this is a server-side table and not just a client-side IndexedDB state**: if a conflict were only visible on the one device that queued the entry, losing or switching that device would make the stuck payment invisible to the rest of the school — a real correctness/audit gap given every other admin-visible concern in this system (anomalies, defaulter risk) is already school-wide, not device-scoped. The client escalates a conflict here via `reportSyncConflict` the moment it's detected (see `api_specification.md`); the bulk of the offline queue itself (queued, not-yet-attempted entries) still lives client-side only, since those aren't yet anyone's problem but the entering admin's.

---

## Relationships (summary)

- SCHOOL 1—* STUDENT, 1—* USER
- USER 1—1 PARENT_LINK (if role = parent)
- PARENT_LINK *—* STUDENT (via `guardian_of`)
- STUDENT 1—* FEE_ASSIGNMENT, 1—* DEFAULTER_SCORE
- FEE_TYPE 1—* FEE_ASSIGNMENT
- FEE_ASSIGNMENT 1—* TRANSACTION
- TRANSACTION 1—0/1 WAIVER, 1—0/1 PENALTY, 1—0/1 RECEIPT, 1—0/1 ANOMALY_FLAG
- USER 1—* AUDIT_LOG (as actor)

---

## Indexes

Previously stated only as prose in `system_architecture.md`'s scalability notes; made explicit and authoritative here, since this document — not the architecture doc — is the one an agent is told to treat as the source of truth for schema detail.

| Table | Index | Reason |
|---|---|---|
| `USER` | `(school_id)` | every admin query scopes by school |
| `STUDENT` | `(school_id)`, `(school_id, class)`, unique `(school_id, admission_number)` scoped to `admission_number IS NOT NULL` *(added Phase 14)* | school scoping + class-wise bulk assignment/reporting; the partial unique index enforces per-school dedup on `admission_number` without rejecting the (permitted) case of a student created without one |
| `FEE_ASSIGNMENT` | `(student_id)`, `(fee_type_id)`, `(due_date)`, `(school_id, payment_status)` | per-student lookups, defaulter/outstanding queries, overdue scans by the daily job |
| `TRANSACTION` | `(fee_assignment_id)`, `(student_id)`, `(school_id, reconciliation_status)`, `(school_id, posted_at)`, unique `(channel, ref_number)` scoped to `channel = 'upi'` | ledger snapshot filtering, reporting date ranges, webhook idempotency (also schema-enforced as a constraint below) |
| `WAIVER` / `PENALTY` | `(transaction_id)` | join from transaction to adjustments |
| `DEFAULTER_SCORE` | `(student_id)`, `(school_id, risk_level)` | defaulter view grouped/sorted by risk |
| `REMINDER_LOG` | `(fee_assignment_id)`, unique `(fee_assignment_id, tier)` | reminder queue lookups; prevents duplicate-tier writes (see Constraints below) |
| `ANOMALY_FLAG` | `(transaction_id)`, `(school_id, resolved)` | anomaly detail lookup, unresolved-flags dashboard filter |
| `AUDIT_LOG` | `(actor_id)`, `(created_at)` | audit review by actor or time range |
| `OCR_STAGING` | `(uploaded_by)`, `(confirmed, created_at)` | stale-upload surfacing (see Assumptions below) |
| `PUSH_SUBSCRIPTION` | `(user_id)`, unique `(endpoint)` | subscription lookup on send; uniqueness prevents duplicate rows if the browser re-subscribes with the same endpoint |
| `OFFLINE_SYNC_CONFLICT` | `(school_id, resolved)`, unique `(local_id)` | unresolved-conflicts dashboard filter; uniqueness on `local_id` prevents a retried escalation call from creating a duplicate conflict record for the same queued entry |

## Business-Rule-Driven Constraints (schema-enforced, not just application-enforced)

- `WAIVER.reason` and `WAIVER.approved_by`: `NOT NULL` at the database level.
- `PENALTY.reason`: `NOT NULL`.
- `OCR_STAGING.confirmed`: defaults `false`; no trigger or application path may set `confirmed_transaction_id` without `confirmed = true` first.
- `TRANSACTION.amount`: `CHECK (amount > 0)` — zero/negative amounts must never reach this table.
- `TRANSACTION.ref_number`: unique constraint scoped to `channel = 'upi'` — the database-level backstop for webhook idempotency, in addition to the application-level check.
- `REMINDER_LOG (fee_assignment_id, tier)`: unique constraint. `FEE_ASSIGNMENT.last_triggered_tier` prevents re-firing a tier in the normal single-job-run flow, but does not by itself stop a concurrent or retried job execution from writing a duplicate row for the same tier before the first run's `UPDATE` commits. This constraint is the database-level backstop for that race, added during Phase 8 design-audit remediation.

## Assumptions

- All monetary fields are `decimal`, never floating point.
- `school_id` scoping is present (directly or via join) on every table an admin or parent can query, to support RLS.
- `OCR_STAGING` rows with `confirmed = false` older than 30 days are surfaced in a "stale OCR uploads" filter on the OCR Upload screen (added Phase 8 — previously unspecified whether unconfirmed rows were ever revisited). Actual deletion/archival policy is left to the agent's judgment as a low-stakes housekeeping decision, not a business rule.

## Future Extensions

Multi-guardian richer relationship metadata (e.g., primary vs. secondary guardian), refund-adjacent transaction type, cross-channel duplicate-payment matching table.

## References

Schema traces to Phase 3 of this project's design process, updated through Phase 6 (cheque clearance states, GST fields, partial-payment derived fields, idempotency constraint). See `decision_log.md` for the reasoning behind each addition.
