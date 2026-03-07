import { Request, Response } from 'express';
import crypto from 'crypto';
import { processWebhookService } from '../services/payment.service';

export const razorpayWebhook = async (req: Request & { rawBody?: string }, res: Response) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    const signature = req.headers['x-razorpay-signature'] as string;

    // Verify signature using the raw request body, not re-serialized JSON
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(req.rawBody ?? '')
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const event = req.body;

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const ledgerId = payment.notes?.ledgerId;

      if (ledgerId) {
        const result = await processWebhookService(
          payment.id,
          payment.order_id,
          ledgerId,
          payment.amount
        );

        if (result.duplicate) {
          console.log(`Duplicate webhook for gatewayPaymentId=${payment.id}, acknowledging`);
          return res.status(200).json({ success: true, duplicate: true });
        }
      }
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};
