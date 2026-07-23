-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('whatsapp', 'sms', 'email');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('logged', 'simulated_sent', 'sent', 'failed');

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh_key" TEXT NOT NULL,
    "auth_key" TEXT NOT NULL,
    "device_label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_staging" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "extracted_amount" DECIMAL(12,2),
    "extracted_date" TIMESTAMP(3),
    "extracted_ref_number" TEXT,
    "raw_extraction" JSONB,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_at" TIMESTAMP(3),
    "confirmed_transaction_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_staging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_logs" (
    "id" TEXT NOT NULL,
    "fee_assignment_id" TEXT NOT NULL,
    "drafted_text" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'logged',
    "dispatch_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "reminder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_user_id_endpoint_key" ON "push_subscriptions"("user_id", "endpoint");

-- CreateIndex
CREATE INDEX "ocr_staging_school_id_idx" ON "ocr_staging"("school_id");

-- CreateIndex
CREATE INDEX "reminder_logs_fee_assignment_id_idx" ON "reminder_logs"("fee_assignment_id");

-- CreateIndex
CREATE INDEX "reminder_logs_status_idx" ON "reminder_logs"("status");

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_logs" ADD CONSTRAINT "reminder_logs_fee_assignment_id_fkey" FOREIGN KEY ("fee_assignment_id") REFERENCES "fee_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
