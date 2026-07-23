---
feature_name: "OCR Receipt Upload"
session: "Session 4"
status: "completed"
type: "core_feature"
---

# Feature Log: OCR Receipt Upload

## Description
Implements the OCR receipt extraction feature (Feature 5) using Gemini Vision. Admin uploads an image URL, Gemini extracts fields, and admin confirms before posting to the ledger.

## Core Logic & Necessary Functions
- `packages/ai/src/processOcrUpload.ts`: Calls Gemini Vision to extract amount, date, refNumber, and payerName.
- `apps/web/src/app/actions/ai.ts` -> `processOcrUploadAction`: Saves extraction to `OCR_STAGING` with `confirmed: false`. NEVER creates a transaction.
- `apps/web/src/app/actions/ai.ts` -> `confirmOcrEntryAction`: Validates the staging row and uses the canonical `recordPayment` action to post the transaction, then flips `confirmed: true`.
- `apps/web/src/app/admin/ocr/page.tsx`: UI with 3 stages (idle, staged preview, confirmed).

## Database Schema Impact
- Added `OcrStaging` model to `schema.prisma`.
  - `confirmed` boolean gate prevents unconfirmed OCR reads from affecting ledger balances.

## Testing & Verification
- Unit tests in `session4.test.ts` verify that `processOcrUploadAction` writes `confirmed: false` and NEVER calls `prisma.$transaction`.
- Tests confirm `confirmOcrEntryAction` rejects if already confirmed.
