-- AlterTable
ALTER TABLE "fee_structures" ALTER COLUMN "base_fee" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "late_fee_amount" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "ledgers" ALTER COLUMN "base_amount" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "late_fee" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "total_amount" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "amount_paid" SET DATA TYPE DECIMAL(10,2);

-- CreateIndex
CREATE INDEX "alerts_resolved_idx" ON "alerts"("resolved");

-- CreateIndex
CREATE INDEX "ledgers_student_id_idx" ON "ledgers"("student_id");

-- CreateIndex
CREATE INDEX "ledgers_status_idx" ON "ledgers"("status");

-- CreateIndex
CREATE INDEX "ledgers_due_date_idx" ON "ledgers"("due_date");

-- CreateIndex
CREATE INDEX "payments_ledger_id_idx" ON "payments"("ledger_id");

-- CreateIndex
CREATE INDEX "students_parent_id_idx" ON "students"("parent_id");
