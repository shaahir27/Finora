# Build Logging Protocol

This governs how you (the coding agent) document your own work in `build_history/` as you build. It is separate from `docs/` — `docs/` is the specification (what to build, decided before any code existed); `build_history/` is the construction record (what you actually built, and why, written as you go). Read this once before Session 1, then follow it for every session after.

## 1. When This Applies

At the end of every session (per `implementation_plan.md`'s six sessions), and for every distinct feature you build within a session — not just once at the very end. Log as you go, not as a final catch-up step; a feature is not "done" until its log exists (see Definition of Done, below).

## 2. Directory Structure — Flat, Session-Numbered

```
build_history/
├── index.md
├── session_01_ledger_core/
│   ├── feature_[name].md          (one per feature)
│   └── session_01_summary.md      (written last, once)
├── session_02_reconciliation/
├── session_03_dashboard_pwa_push/
├── session_04_ai_copilot/
├── session_05_parent_portal/
└── session_06_polish_demo/
```

- Session folder names are fixed — use exactly the six above, matching `implementation_plan.md`. Don't invent a `session_07` for extra work; if a fix or addition happens outside the normal session flow, it still belongs in whichever session's folder the feature it's fixing originally lived in.
- No subfolders inside a session folder. Every feature file sits directly inside its session folder.
- Feature file naming: `feature_[snake_case_name].md` — short, specific, matching the feature's name in `docs/product_requirements.md` where one exists (e.g. `feature_offline_payment_entry.md` for M-7, not `feature_offline.md`).

## 3. Template — Non-Negotiable Structure

Use `docs/templates/log_schema.md` for every feature log, every time. Copy the structure, fill every `{{PLACEHOLDER}}`, don't drop sections. Section 4 (Key Functions & Logic, with exact file paths) is mandatory even for small features — it's what makes this directory useful for navigation months later, which is the entire reason it exists.

## 4. Updating vs. Creating New — the rule that actually matters here

This is the part most likely to be gotten wrong, so it's stated explicitly:

**Same feature touched again later → update the original file, in its original session folder.** If Session 3 builds push notifications and Session 3 (later, same session) or a later session extends what push notifications trigger on, that's still `feature_push_notifications.md` in `session_03_dashboard_pwa_push/` — open it, add to the relevant section, don't create a second file. Before creating any new feature file, check whether a file with that feature's name already exists anywhere in `build_history/` — search across all session folders, not just the current one.

**New feature that merely calls or depends on an existing one → new file, with a cross-reference.** `syncOfflinePayment` (Session 3) calling `recordPayment` (Session 1) is a new feature that depends on an old one — it gets its own `feature_offline_payment_entry.md`, with a one-line note in Section 6 pointing back to `feature_reconciliation_ledger.md`. Don't merge these into one file just because the code calls into the other; don't split what's genuinely one feature into two files either.

**When updating an existing log**: append or revise the specific section that changed; don't overwrite the whole file. If you're correcting something that was factually wrong (not just adding something new), say so directly in the edit rather than silently rewriting history — e.g. "Section 4 corrected: `handleWebhook` actually lives in `packages/payments/webhook.ts`, not `apps/web/api/webhook.ts` as originally logged." This mirrors the same discipline `docs/decision_log.md` already uses for the specification itself — a correction is marked as a correction, not quietly absorbed.

## 5. Index Management

`build_history/index.md` is the map into everything else — keep it current after every file creation or update, not just at session end. Table format:

| Feature | Session | File | Status | Last Updated |
|---|---|---|---|---|
| Offline Payment Entry | 3 | `session_03_dashboard_pwa_push/feature_offline_payment_entry.md` | Built | Session 3 |

`Status` is `Built`, `Updated`, or `Deferred` (started but incomplete — say why in the log itself, in Section 6). `Last Updated` names the session that most recently touched the file, even if it was originally built in an earlier one.

## 6. Session Summaries

At the end of each session, once every feature built that session has its own log, write `session_XX_summary.md` in that session's folder — a short aggregate: what got built, which checkpoint items from `implementation_plan.md` passed, anything deferred to a later session and why. This is a summary of already-logged work, not a replacement for the individual feature logs.

## 7. Confidentiality — what this actually means in practice

This project's specification and business logic are for internal/team use, not for posting publicly or pasting into unrelated external tools or chats outside this project. That does **not** mean writing vague or watered-down logs — the entire value of `build_history/` is a detailed, honest internal record, and a log that hedges on detail to be "safe" defeats its own purpose. The one hard rule with no exceptions: **never write a real secret value into any log file** — API keys, tokens, credentials, connection strings. Reference them by env var name only (the exact same secrets are already named, by env var, in `docs/security.md` Secrets Management — use that list as the reference for what counts as a secret if you're ever unsure). That's the actual boundary; everything else about how the system works is exactly what these logs exist to document, in full.

## 8. Definition of Done

A feature is not complete until:
1. The code is implemented and verified against its spec in `docs/`.
2. Its `feature_[name].md` log exists (new) or is updated (existing), per the rule in Section 4.
3. `build_history/index.md` reflects it.

A session is not complete until every feature built that session meets the above, `session_XX_summary.md` exists, and — per `implementation_plan.md` — that session's own checkpoint and the automated tests in `docs/testing_strategy.md` for that session both pass. Logging a feature that doesn't actually pass its checkpoint is worse than not logging it — don't log something as done to satisfy this protocol if it isn't actually done per the spec.

## 9. Priority Order When These Ever Conflict

Working code that correctly satisfies `docs/` is the absolute priority. This logging protocol is real and not optional, but it never justifies weakening architecture, skipping a required test, or shipping something that doesn't match spec just to keep the log current. If time runs short in a session, an incomplete log with a clear "Section 6: deferred, ran out of session time" note is the right move — never a rushed feature that technically satisfies this protocol but not the actual spec in `docs/`.
