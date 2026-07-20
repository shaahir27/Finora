-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'parent');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('active', 'withdrawn', 'graduated', 'transferred');

-- CreateEnum
CREATE TYPE "BalanceDisposition" AS ENUM ('write_off', 'carry_forward');

-- CreateEnum
CREATE TYPE "GstTreatment" AS ENUM ('exempt', 'taxable');

-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('upi', 'cash', 'cheque');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('posted', 'flagged', 'reversed', 'cheque_pending');

-- CreateTable
CREATE TABLE "schools" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "school_id" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_links" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "parent_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian_of" (
    "parent_link_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,

    CONSTRAINT "guardian_of_pkey" PRIMARY KEY ("parent_link_id","student_id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "admission_number" TEXT,
    "status" "StudentStatus" NOT NULL DEFAULT 'active',
    "status_changed_at" TIMESTAMP(3),
    "balance_disposition" "BalanceDisposition",

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before_state" JSONB NOT NULL,
    "after_state" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_types" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "gst_treatment" "GstTreatment" NOT NULL,
    "gst_rate" DECIMAL(5,2),

    CONSTRAINT "fee_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_assignments" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "fee_type_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "due_date" DATE NOT NULL,
    "last_triggered_tier" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "fee_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "fee_assignment_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "channel" "PaymentChannel" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "ref_number" TEXT,
    "reconciliation_status" "ReconciliationStatus" NOT NULL DEFAULT 'posted',
    "status" TEXT NOT NULL DEFAULT 'active',
    "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waivers" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT,
    "fee_assignment_id" TEXT NOT NULL,
    "approved_by" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "waivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penalties" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "penalties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defaulter_scores" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "risk_level" INTEGER NOT NULL,
    "computed_reason" TEXT NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "defaulter_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anomaly_flags" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "expected_amount" DECIMAL(12,2) NOT NULL,
    "received_amount" DECIMAL(12,2) NOT NULL,
    "flag_reason" TEXT NOT NULL,
    "narration" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anomaly_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_sync_conflicts" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "submitted_by" TEXT NOT NULL,
    "local_id" TEXT NOT NULL,
    "fee_assignment_id" TEXT NOT NULL,
    "channel" "PaymentChannel" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "queued_at" TIMESTAMP(3) NOT NULL,
    "conflict_reason" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution_action" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offline_sync_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_school_id_idx" ON "users"("school_id");

-- CreateIndex
CREATE UNIQUE INDEX "parent_links_user_id_key" ON "parent_links"("user_id");

-- CreateIndex
CREATE INDEX "students_school_id_idx" ON "students"("school_id");

-- CreateIndex
CREATE INDEX "students_school_id_class_idx" ON "students"("school_id", "class");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "fee_assignments_student_id_idx" ON "fee_assignments"("student_id");

-- CreateIndex
CREATE INDEX "fee_assignments_fee_type_id_idx" ON "fee_assignments"("fee_type_id");

-- CreateIndex
CREATE INDEX "fee_assignments_due_date_idx" ON "fee_assignments"("due_date");

-- CreateIndex
CREATE INDEX "transactions_fee_assignment_id_idx" ON "transactions"("fee_assignment_id");

-- CreateIndex
CREATE INDEX "transactions_student_id_idx" ON "transactions"("student_id");

-- CreateIndex
CREATE INDEX "transactions_school_id_reconciliation_status_idx" ON "transactions"("school_id", "reconciliation_status");

-- CreateIndex
CREATE INDEX "transactions_school_id_posted_at_idx" ON "transactions"("school_id", "posted_at");

-- CreateIndex
CREATE INDEX "waivers_transaction_id_idx" ON "waivers"("transaction_id");

-- CreateIndex
CREATE INDEX "penalties_transaction_id_idx" ON "penalties"("transaction_id");

-- CreateIndex
CREATE INDEX "defaulter_scores_student_id_idx" ON "defaulter_scores"("student_id");

-- CreateIndex
CREATE INDEX "defaulter_scores_school_id_risk_level_idx" ON "defaulter_scores"("school_id", "risk_level");

-- CreateIndex
CREATE UNIQUE INDEX "anomaly_flags_transaction_id_key" ON "anomaly_flags"("transaction_id");

-- CreateIndex
CREATE INDEX "anomaly_flags_school_id_resolved_idx" ON "anomaly_flags"("school_id", "resolved");

-- CreateIndex
CREATE UNIQUE INDEX "offline_sync_conflicts_local_id_key" ON "offline_sync_conflicts"("local_id");

-- CreateIndex
CREATE INDEX "offline_sync_conflicts_school_id_resolved_idx" ON "offline_sync_conflicts"("school_id", "resolved");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_links" ADD CONSTRAINT "parent_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_of" ADD CONSTRAINT "guardian_of_parent_link_id_fkey" FOREIGN KEY ("parent_link_id") REFERENCES "parent_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_of" ADD CONSTRAINT "guardian_of_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_types" ADD CONSTRAINT "fee_types_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_assignments" ADD CONSTRAINT "fee_assignments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_assignments" ADD CONSTRAINT "fee_assignments_fee_type_id_fkey" FOREIGN KEY ("fee_type_id") REFERENCES "fee_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_assignments" ADD CONSTRAINT "fee_assignments_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_fee_assignment_id_fkey" FOREIGN KEY ("fee_assignment_id") REFERENCES "fee_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waivers" ADD CONSTRAINT "waivers_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waivers" ADD CONSTRAINT "waivers_fee_assignment_id_fkey" FOREIGN KEY ("fee_assignment_id") REFERENCES "fee_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waivers" ADD CONSTRAINT "waivers_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defaulter_scores" ADD CONSTRAINT "defaulter_scores_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defaulter_scores" ADD CONSTRAINT "defaulter_scores_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomaly_flags" ADD CONSTRAINT "anomaly_flags_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_sync_conflicts" ADD CONSTRAINT "offline_sync_conflicts_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_sync_conflicts" ADD CONSTRAINT "offline_sync_conflicts_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_sync_conflicts" ADD CONSTRAINT "offline_sync_conflicts_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
