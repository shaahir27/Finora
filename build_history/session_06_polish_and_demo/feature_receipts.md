---
feature_name: "Receipt Generation & GST Logic"
session: "Session 6"
status: "completed"
---

## What was built
- Added `Receipt` model to Prisma schema (with `ReceiptFormat` enum).
- Added `generateReceipt` server action in `apps/web/src/app/actions/receipts.ts`.
- Implemented GST-inclusive back-calculation formula (`amount * (rate / (100 + rate))`) directly in the receipt generation logic.
- Snapshots GST treatment and rate into `gstDetails` JSON field at time of generation so historical receipts are immutable.
- Built Admin Receipts UI (`/admin/receipts`) to display posted transactions and generate A4/Thermal PDF receipts.

## Governing Principles enforced
- **GST Logic (Principle 5/6 context)**: Strictly enforces GST-inclusive calculation. There is no code path for B2B exclusive pricing.

## Database Schema Impact
- **New Tables**: `RECEIPT` (links 1:1 to `TRANSACTION`).

## Core Logic & Necessary Functions
- `generateReceipt(txId, format)` acquires a DB transaction, computes GST, creates `RECEIPT`, and returns URL/receiptNumber.
