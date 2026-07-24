---
feature_name: "Action Rate Limiting"
session: "Session 6"
status: "completed"
---

## What was built
- Added simple in-memory rate limiting utility `rateLimit.ts` in `apps/web/src/lib/rateLimit.ts`.
- Wrapped AI endpoints (`processOcrUploadAction`, `answerDashboardQueryAction`) and Export endpoints (`generateReconciliationReport`) in rate limits (10 per minute per admin session).

## Governing Principles enforced
- **Cost/Abuse Control**: Prevents rapid automated abuse of the expensive Gemini-backed endpoints and large data exports.

## Core Logic & Necessary Functions
- `rateLimit(key, options)` checks an in-memory map for the count and expiration, returning true if allowed and false if rate limited.
