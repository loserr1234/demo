import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/prisma';
import { processWebhookService } from '../services/payment.service';
import logger from '../utils/logger';

export const razorpayWebhook = async (req: Request & { rawBody?: string }, res: Response) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      logger.error('Webhook rejected: RAZORPAY_WEBHOOK_SECRET not configured');
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
      logger.error('Webhook signature verification failed', { ip: req.ip });
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const event = req.body;

    if (event.event !== 'payment.captured') {
      return res.status(200).json({ success: true });
    }

    const payment = event.payload.payment.entity;
    logger.info('Webhook received: payment.captured', { gatewayPaymentId: payment.id, orderId: payment.order_id, amount: payment.amount });

    const ledgerId = payment.notes?.ledgerId as string | undefined;

    if (!ledgerId) {
      const msg = `Webhook payment.captured missing ledgerId in notes: payment_id=${payment.id}`;
      logger.warn('Webhook alert: missing ledgerId in payment notes', { gatewayPaymentId: payment.id, orderId: payment.order_id });
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
      logger.warn('Webhook alert: ledger not found', { gatewayPaymentId: payment.id, ledgerId });
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
      logger.info('Webhook: duplicate payment acknowledged', { gatewayPaymentId: payment.id });
      return res.status(200).json({ success: true, duplicate: true });
    }

    const newStatus = 'newStatus' in result ? result.newStatus : 'recorded';
    logger.info('Webhook: payment recorded, ledger updated', { gatewayPaymentId: payment.id, ledgerId, newStatus });
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error('Webhook processing error', { error: (err as Error).message, stack: (err as Error).stack });
    res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};
