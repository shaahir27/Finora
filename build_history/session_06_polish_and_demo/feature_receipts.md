# Feature: Receipt Generation & GST Logic

## 1. Overview
* **Name:** Receipt Generation & GST Logic
* **Session:** Session 6 — Polish & Demo
* **Purpose:** Generates immutable, GST-compliant PDF receipts for posted transactions using a 3-phase execution architecture.
* **Traces to:** `product_requirements.md` (M-8) and `financial_engine.md`.

## 2. Technical Rationale
* **How we achieved it:** 
  - Phase 1: Short DB transaction locks the assignment, calculates GST-inclusive amounts (`amount * (rate / (100 + rate))`), reserves the `RECEIPT` row, and snapshots `gstDetails` JSON.
  - Phase 2: Renders PDF stream via `@react-pdf/renderer` outside open DB transaction blocks, eliminating lock holding during cloud upload.
  - Phase 3: Uploads to Supabase Storage and updates `pdfUrl`.
* **Alternatives considered:** Generating PDF synchronously inside DB transaction.
* **Why we chose this path:** Prevents DB transaction timeouts and long table locks during slow PDF rendering/network uploads.

## 3. Database Schema Impact
* **Changes made:**
  - Added `Receipt` model to Prisma schema with `ReceiptFormat` enum.
  - Denormalized `schoolId` onto `Receipt` with FK to `School.id` and `@@unique([schoolId, receiptNumber])` to prevent receipt number collisions under concurrency.
  - Migration `20260726000000_constraints_and_indexes` added to backfill `school_id` and create `receipts_school_id_receipt_number_key` unique index.

## 4. Core Logic & Necessary Functions
* **List of functions & files:** Key functions added or modified, and their exact file paths.
  * `generateReceipt` (`apps/web/src/app/actions/receipts.ts`): Validates caller permissions (`requireAdminForSchool` or `requireParentSession` with `guardianOf` check), reserves receipt with `P2002` duplicate receipt number handling, renders PDF, uploads to Supabase, and returns `{ pdfUrl, receiptNumber }`.
  ```typescript
  export async function generateReceipt(
    transactionId: string, format: ReceiptFormat
  ): Promise<{ pdfUrl: string; receiptNumber: string }>
  ```

## 5. Testing & Verification
* **Automated tests:** `apps/web/tests/session6.test.ts` — verifies receipt generation, GST calculation, audit log creation, and authorization check.
* **Manually verified:** Verified receipt PDF download in browser and Supabase Storage fallback to Data URL.

## 6. Dependencies & Deferred Work
* **Depends on:** `@react-pdf/renderer`, Supabase Storage (`supabaseAdmin`).
* **Updates applied in Audit Pass:** Added `schoolId` column & unique constraint `[schoolId, receiptNumber]` in migration, added `P2002` error handling for duplicate receipt number generation.


