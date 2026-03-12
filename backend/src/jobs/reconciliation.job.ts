import cron from 'node-cron';
import prisma from '../config/prisma';
import razorpay from '../config/razorpay';
import { processWebhookService } from '../services/payment.service';

export const runReconciliationJob = async (): Promise<{ reconciled: number; alerts: number }> => {
  const now = Math.floor(Date.now() / 1000);
  const from = now - 48 * 60 * 60; // last 48 hours in Unix seconds

  let skip = 0;
  const count = 100;
  let reconciled = 0;
  let alerts = 0;
  let hasMore = true;

  console.log('[RECONCILE] Starting reconciliation for last 48 hours...');

  while (hasMore) {
    const response = await (razorpay.payments as any).all({ from, to: now, count, skip });
    const payments: any[] = response.items || [];

    for (const payment of payments) {
      if (payment.status !== 'captured') continue;

      // Check if already in DB
      const existing = await prisma.payment.findUnique({
        where: { gatewayPaymentId: payment.id },
      });

      if (existing) continue;

      // Not in DB — needs reconciliation
      const ledgerId = payment.notes?.ledgerId as string | undefined;

      if (!ledgerId) {
        const msg = `ALERT: captured payment ${payment.id} has no ledgerId in notes`;
        console.warn(`[RECONCILE] ${msg}`);
        await prisma.alert.create({
          data: {
            type: 'MISSING_LEDGER_ID',
            message: msg,
            data: {
              paymentId: payment.id,
              orderId: payment.order_id,
              amount: payment.amount,
              createdAt: payment.created_at,
            },
          },
        });
        alerts++;
        continue;
      }

      const ledger = await prisma.ledger.findUnique({ where: { id: ledgerId } });

      if (!ledger) {
        const msg = `ALERT: captured payment ${payment.id} references non-existent ledger ${ledgerId}`;
        console.warn(`[RECONCILE] ${msg}`);
        await prisma.alert.create({
          data: {
            type: 'LEDGER_NOT_FOUND',
            message: msg,
            data: {
              paymentId: payment.id,
              orderId: payment.order_id,
              ledgerId,
              amount: payment.amount,
            },
          },
        });
        alerts++;
        continue;
      }

      if (ledger.status === 'PAID' || ledger.status === 'WAIVED') {
        // Ledger is paid but this payment ID isn't recorded — it's truly a duplicate capture
        const msg = `ALERT: captured payment ${payment.id} for already-PAID ledger ${ledgerId}`;
        console.warn(`[RECONCILE] ${msg}`);
        await prisma.alert.create({
          data: {
            type: 'DUPLICATE_CAPTURE',
            message: msg,
            data: {
              paymentId: payment.id,
              orderId: payment.order_id,
              ledgerId,
              amount: payment.amount,
            },
          },
        });
        alerts++;
        continue;
      }

      // Record the missing payment
      try {
        const result = await processWebhookService(
          payment.id,
          payment.order_id,
          ledgerId,
          payment.amount,
        );

        if (result.duplicate) {
          console.log(`[RECONCILE] Already recorded (duplicate): payment ${payment.id}`);
        } else {
          console.log(`[RECONCILE] RECONCILED: payment ${payment.id} for ledger ${ledgerId}`);
          reconciled++;
        }
      } catch (err) {
        const msg = `Failed to reconcile payment ${payment.id}: ${(err as Error).message}`;
        console.error(`[RECONCILE] ${msg}`);
        await prisma.alert.create({
          data: {
            type: 'RECONCILE_ERROR',
            message: msg,
            data: { paymentId: payment.id, ledgerId, error: (err as Error).message },
          },
        });
        alerts++;
      }
    }

    hasMore = payments.length === count;
    skip += count;
  }

  console.log(`[RECONCILE] Complete: ${reconciled} reconciled, ${alerts} alerts`);
  return { reconciled, alerts };
};

export const startReconciliationJob = () => {
  cron.schedule('0 * * * *', async () => {
    console.log('[RECONCILE] Running hourly reconciliation job...');
    try {
      await runReconciliationJob();
    } catch (err) {
      console.error('[RECONCILE] Job failed:', err);
    }
  });

  console.log('[CRON] Reconciliation job scheduled (hourly)');
};
