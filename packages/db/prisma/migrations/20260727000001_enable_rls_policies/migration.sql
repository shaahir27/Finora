-- Migration: Enable Row-Level Security (RLS) & Apply Security Policies
-- Reference: docs/security.md § Row-Level Security Policy

-- ===================================================================
-- 1. Enable RLS on all 18 tables
-- ===================================================================

ALTER TABLE "schools" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parent_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "guardian_of" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fee_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fee_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "waivers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "penalties" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "defaulter_scores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "anomaly_flags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reminder_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ocr_staging" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "offline_sync_conflicts" ENABLE ROW LEVEL SECURITY;

-- ===================================================================
-- 2. Define Helper Functions for Fast RLS Evaluation (casting auth.uid() to text)
-- ===================================================================

CREATE OR REPLACE FUNCTION rls_current_user_school_id()
RETURNS text AS $$
  SELECT school_id FROM "users" WHERE id::text = auth.uid()::text;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION rls_current_parent_student_ids()
RETURNS TABLE (student_id text) AS $$
  SELECT g.student_id
  FROM "guardian_of" g
  JOIN "parent_links" pl ON g.parent_link_id = pl.id
  WHERE pl.user_id::text = auth.uid()::text;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ===================================================================
-- 3. Apply Admin & Parent Policies (docs/security.md)
-- ===================================================================

-- SCHOOLS: Admin/Parent can read their school
DROP POLICY IF EXISTS "rls_schools_select" ON "schools";
CREATE POLICY "rls_schools_select" ON "schools"
  FOR SELECT USING (
    id = rls_current_user_school_id()
    OR id IN (
      SELECT s.school_id FROM "students" s WHERE s.id IN (SELECT rls_current_parent_student_ids())
    )
  );

-- USERS: Admin reads/updates school users; parent reads own row
DROP POLICY IF EXISTS "rls_users_select" ON "users";
CREATE POLICY "rls_users_select" ON "users"
  FOR SELECT USING (
    school_id = rls_current_user_school_id() OR id::text = auth.uid()::text
  );

-- PARENT_LINKS: Admin reads school links; parent reads own link
DROP POLICY IF EXISTS "rls_parent_links_select" ON "parent_links";
CREATE POLICY "rls_parent_links_select" ON "parent_links"
  FOR SELECT USING (
    user_id::text = auth.uid()::text OR id IN (
      SELECT g.parent_link_id FROM "guardian_of" g
      JOIN "students" s ON g.student_id = s.id
      WHERE s.school_id = rls_current_user_school_id()
    )
  );

-- GUARDIAN_OF: Admin manages school links; parent reads own links
DROP POLICY IF EXISTS "rls_guardian_of_select" ON "guardian_of";
CREATE POLICY "rls_guardian_of_select" ON "guardian_of"
  FOR SELECT USING (
    student_id IN (SELECT rls_current_parent_student_ids())
    OR student_id IN (SELECT id FROM "students" WHERE school_id = rls_current_user_school_id())
  );

-- STUDENTS: Admin full access for school; parent reads linked children
DROP POLICY IF EXISTS "rls_students_admin" ON "students";
CREATE POLICY "rls_students_admin" ON "students"
  FOR ALL USING (school_id = rls_current_user_school_id());

DROP POLICY IF EXISTS "rls_students_parent" ON "students";
CREATE POLICY "rls_students_parent" ON "students"
  FOR SELECT USING (id IN (SELECT rls_current_parent_student_ids()));

-- FEE_TYPES: Admin full access; parent select active fee types
DROP POLICY IF EXISTS "rls_fee_types_admin" ON "fee_types";
CREATE POLICY "rls_fee_types_admin" ON "fee_types"
  FOR ALL USING (school_id = rls_current_user_school_id());

DROP POLICY IF EXISTS "rls_fee_types_parent" ON "fee_types";
CREATE POLICY "rls_fee_types_parent" ON "fee_types"
  FOR SELECT USING (
    school_id IN (
      SELECT s.school_id FROM "students" s WHERE s.id IN (SELECT rls_current_parent_student_ids())
    )
  );

-- FEE_ASSIGNMENTS: Admin full access; parent select for linked students
DROP POLICY IF EXISTS "rls_fee_assignments_admin" ON "fee_assignments";
CREATE POLICY "rls_fee_assignments_admin" ON "fee_assignments"
  FOR ALL USING (school_id = rls_current_user_school_id());

DROP POLICY IF EXISTS "rls_fee_assignments_parent" ON "fee_assignments";
CREATE POLICY "rls_fee_assignments_parent" ON "fee_assignments"
  FOR SELECT USING (student_id IN (SELECT rls_current_parent_student_ids()));

-- TRANSACTIONS: Admin full access; parent select linked student txs & insert upi
DROP POLICY IF EXISTS "rls_transactions_admin" ON "transactions";
CREATE POLICY "rls_transactions_admin" ON "transactions"
  FOR ALL USING (school_id = rls_current_user_school_id());

DROP POLICY IF EXISTS "rls_transactions_parent_select" ON "transactions";
CREATE POLICY "rls_transactions_parent_select" ON "transactions"
  FOR SELECT USING (student_id IN (SELECT rls_current_parent_student_ids()));

DROP POLICY IF EXISTS "rls_transactions_parent_insert" ON "transactions";
CREATE POLICY "rls_transactions_parent_insert" ON "transactions"
  FOR INSERT WITH CHECK (
    channel = 'upi' AND student_id IN (SELECT rls_current_parent_student_ids())
  );

-- RECEIPTS: Admin full access; parent select for linked transactions
DROP POLICY IF EXISTS "rls_receipts_admin" ON "receipts";
CREATE POLICY "rls_receipts_admin" ON "receipts"
  FOR ALL USING (transaction_id IN (SELECT id FROM "transactions" WHERE school_id = rls_current_user_school_id()));

DROP POLICY IF EXISTS "rls_receipts_parent" ON "receipts";
CREATE POLICY "rls_receipts_parent" ON "receipts"
  FOR SELECT USING (
    transaction_id IN (
      SELECT id FROM "transactions" WHERE student_id IN (SELECT rls_current_parent_student_ids())
    )
  );

-- ADMIN-ONLY TABLES: waivers, penalties, defaulter_scores, anomaly_flags, reminder_logs, ocr_staging, audit_logs
DROP POLICY IF EXISTS "rls_waivers_admin" ON "waivers";
CREATE POLICY "rls_waivers_admin" ON "waivers"
  FOR ALL USING (fee_assignment_id IN (SELECT id FROM "fee_assignments" WHERE school_id = rls_current_user_school_id()));

DROP POLICY IF EXISTS "rls_penalties_admin" ON "penalties";
CREATE POLICY "rls_penalties_admin" ON "penalties"
  FOR ALL USING (transaction_id IN (SELECT id FROM "transactions" WHERE school_id = rls_current_user_school_id()));

DROP POLICY IF EXISTS "rls_defaulter_scores_admin" ON "defaulter_scores";
CREATE POLICY "rls_defaulter_scores_admin" ON "defaulter_scores"
  FOR ALL USING (school_id = rls_current_user_school_id());

DROP POLICY IF EXISTS "rls_anomaly_flags_admin" ON "anomaly_flags";
CREATE POLICY "rls_anomaly_flags_admin" ON "anomaly_flags"
  FOR ALL USING (school_id = rls_current_user_school_id());

DROP POLICY IF EXISTS "rls_reminder_logs_admin" ON "reminder_logs";
CREATE POLICY "rls_reminder_logs_admin" ON "reminder_logs"
  FOR ALL USING (fee_assignment_id IN (SELECT id FROM "fee_assignments" WHERE school_id = rls_current_user_school_id()));

DROP POLICY IF EXISTS "rls_ocr_staging_admin" ON "ocr_staging";
CREATE POLICY "rls_ocr_staging_admin" ON "ocr_staging"
  FOR ALL USING (school_id = rls_current_user_school_id());

DROP POLICY IF EXISTS "rls_audit_logs_admin" ON "audit_logs";
CREATE POLICY "rls_audit_logs_admin" ON "audit_logs"
  FOR ALL USING (actor_id IN (SELECT id FROM "users" WHERE school_id = rls_current_user_school_id()));

-- PUSH_SUBSCRIPTIONS: Own user row scoping
DROP POLICY IF EXISTS "rls_push_subscriptions_own" ON "push_subscriptions";
CREATE POLICY "rls_push_subscriptions_own" ON "push_subscriptions"
  FOR ALL USING (user_id::text = auth.uid()::text);

-- OFFLINE_SYNC_CONFLICTS: School-wide admin access
DROP POLICY IF EXISTS "rls_offline_sync_conflicts_admin" ON "offline_sync_conflicts";
CREATE POLICY "rls_offline_sync_conflicts_admin" ON "offline_sync_conflicts"
  FOR ALL USING (school_id = rls_current_user_school_id());
