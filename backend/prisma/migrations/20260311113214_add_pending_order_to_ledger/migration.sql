-- AlterTable
ALTER TABLE "ledgers" ADD COLUMN     "pending_order_created_at" TIMESTAMP(3),
ADD COLUMN     "pending_order_id" TEXT;
