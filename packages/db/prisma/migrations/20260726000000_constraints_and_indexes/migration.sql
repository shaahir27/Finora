-- Migration: Add missing DB constraints and indexes
-- Fix 13: Receipt school_id column + per-school unique receipt number
-- Fix 19: UPI ref idempotency, admission number dedup, positive amount check

-- -------------------------------------------------------------------
-- Fix 19a: UPI idempotency — partial unique index on ref_number for UPI channel
-- (Claimed in schema comments since day 1; never actually created.)
-- -------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "transactions_upi_ref_number_key"
  ON "transactions" ("ref_number") WHERE "channel" = 'upi' AND "ref_number" IS NOT NULL;

-- -------------------------------------------------------------------
-- Fix 19b: Prevent duplicate admission numbers within a school
-- -------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "students_school_admission_number_key"
  ON "students" ("school_id", "admission_number") WHERE "admission_number" IS NOT NULL;

-- -------------------------------------------------------------------
-- Fix 19c: DB-level enforcement that transaction amounts are positive
-- Application code already checks this, but a DB constraint is the
-- last-resort backstop for any path that bypasses application logic.
-- -------------------------------------------------------------------
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_amount_positive_check" CHECK ("amount" > 0);

-- -------------------------------------------------------------------
-- Fix 13: receipts.school_id + per-school unique receipt number
--
-- The schema already defines schoolId on the Receipt model and
-- @@unique([schoolId, receiptNumber]). This migration applies it to
-- the actual database.
--
-- Step 1: Add the column as nullable first (safe for existing rows).
-- Step 2: Backfill from the joined transactions table.
-- Step 3: Make it NOT NULL once all rows are populated.
-- Step 4: Add FK and unique constraint.
-- -------------------------------------------------------------------

-- Step 1: Add column nullable
ALTER TABLE "receipts" ADD COLUMN IF NOT EXISTS "school_id" TEXT;

-- Step 2: Backfill from the transactions table (via the existing FK)
UPDATE "receipts" r
SET "school_id" = t."school_id"
FROM "transactions" t
WHERE r."transaction_id" = t."id"
  AND r."school_id" IS NULL;

-- Step 3: Enforce NOT NULL (all rows should be backfilled)
ALTER TABLE "receipts" ALTER COLUMN "school_id" SET NOT NULL;

-- Step 4: FK constraint
ALTER TABLE "receipts"
  ADD CONSTRAINT "receipts_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 5: Per-school unique receipt number (the real collision prevention)
CREATE UNIQUE INDEX IF NOT EXISTS "receipts_school_id_receipt_number_key"
  ON "receipts" ("school_id", "receipt_number");
