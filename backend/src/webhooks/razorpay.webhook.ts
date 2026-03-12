import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/prisma';
import { processWebhookService } from '../services/payment.service';

export const razorpayWebhook = async (req: Request & { rawBody?: string }, res: Response) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[WEBHOOK] RAZORPAY_WEBHOOK_SECRET is not set — rejecting webhook');
      return res.status(500).json({ success: false, message: 'Webhook secret not configured' });
    }
    const signature = req.headers['x-razorpay-signature'] as string;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(req.rawBody ?? '')
      .digest('hex');

    const sigBuf = Buffer.from(signature || '', 'hex');
    const expectedBuf = Buffer.from(expectedSignature, 'hex');
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      console.warn('[WEBHOOK] Invalid signature received');
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const event = req.body;

    if (event.event !== 'payment.captured') {
      return res.status(200).json({ success: true });
    }

    const payment = event.payload.payment.entity;
    console.log(`[WEBHOOK] payment.captured received: payment_id=${payment.id} order_id=${payment.order_id} amount=${payment.amount}`);

    const ledgerId = payment.notes?.ledgerId as string | undefined;

    if (!ledgerId) {
      const msg = `Webhook payment.captured missing ledgerId in notes: payment_id=${payment.id}`;
      console.warn(`[WEBHOOK] ${msg}`);
      await prisma.alert.create({
        data: {
          type: 'MISSING_LEDGER_ID',
          message: msg,
          data: {
            paymentId: payment.id,
            orderId: payment.order_id,
            amount: payment.amount,
          },
        },
      });
      return res.status(200).json({ success: true, warning: 'No ledgerId in notes — alert created' });
    }

    const ledger = await prisma.ledger.findUnique({ where: { id: ledgerId } });

    if (!ledger) {
      const msg = `Webhook payment.captured references non-existent ledger ${ledgerId}: payment_id=${payment.id}`;
      console.warn(`[WEBHOOK] ${msg}`);
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
      return res.status(200).json({ success: true, warning: 'Ledger not found — alert created' });
    }

    const result = await processWebhookService(
      payment.id,
      payment.order_id,
      ledgerId,
      payment.amount,
    );

    if (result.duplicate) {
      console.log(`[WEBHOOK] Duplicate for payment_id=${payment.id} — acknowledged`);
      return res.status(200).json({ success: true, duplicate: true });
    }

    const status = 'newStatus' in result ? result.newStatus : 'recorded';
    console.log(`[WEBHOOK] Recorded payment ${payment.id} → ledger ${ledgerId} → status ${status}`);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[WEBHOOK] Error:', err);
    res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};
