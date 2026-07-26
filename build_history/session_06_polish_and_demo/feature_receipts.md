---
feature_name: "Receipt Generation & GST Logic"
session: "Session 6"
status: "completed"
---

## What was built
- Added `Receipt` model to Prisma schema (with `ReceiptFormat` enum).
- Added `generateReceipt` server action in `apps/web/src/app/actions/receipts.ts` with 3-phase execution architecture (Phase 1: DB transaction fetches transaction & creates receipt record; Phase 2: React PDF buffer rendered outside DB transaction; Phase 3: Supabase Storage upload / data URL fallback).
- Implemented GST-inclusive back-calculation formula (`amount * (rate / (100 + rate))`) directly in the receipt generation logic.
- Snapshots GST treatment and rate into `gstDetails` JSON field at time of generation so historical receipts are immutable.
- Built Admin Receipts UI (`/admin/receipts`) and Parent History UI (`/parent/history`) to download receipts with strict student-parent ownership verification.

## Governing Principles enforced
- **GST Logic (Principle 5/6 context)**: Strictly enforces GST-inclusive calculation. There is no code path for B2B exclusive pricing.
- **Transaction Safety**: PDF generation and cloud upload execute outside DB transaction blocks, eliminating transaction timeout risks.
- **Parent Access**: Parent download requests verify linked student ownership (`guardianOf` relationship) before returning receipts.

## Database Schema Impact
- **New Tables**: `RECEIPT` (links 1:1 to `TRANSACTION`).

## Core Logic & Necessary Functions
- `generateReceipt(txId, format, requestingUserId)` validates caller permissions (admin for school or parent linked to student), executes 3-phase generation, computes GST, creates `RECEIPT`, and returns `{ pdfUrl, receiptNumber }`.

