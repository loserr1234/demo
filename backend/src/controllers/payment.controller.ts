import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import {
  createOrderService,
  recordManualPaymentService,
  getPaymentByIdService,
  getAllPaymentsService,
  getReceiptFileService,
} from '../services/payment.service';
import { sendSuccess } from '../utils/response';
import { BadRequestError } from '../utils/errors';

const manualPaymentSchema = z.object({
  ledgerId: z.string().uuid(),
  paymentMethod: z.enum(['CASH', 'UPI', 'BANK']),
  referenceNumber: z.string().optional(),
  paymentDate: z.string().optional(),
});

export const createOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ledgerId } = req.body;
    if (!ledgerId) throw new BadRequestError('ledgerId is required');
    const order = await createOrderService(ledgerId, req.user!.userId, req.user!.role);
    sendSuccess(res, order, 'Order created successfully');
  } catch (err) {
    next(err);
  }
};

export const recordManualPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = manualPaymentSchema.parse(req.body);
    const result = await recordManualPaymentService(data, req.user!.userId);
    sendSuccess(res, result, 'Payment recorded successfully', 201);
  } catch (err) {
    if (err instanceof z.ZodError) return next(new BadRequestError(err.errors[0].message));
    next(err);
  }
};

export const getPaymentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await getPaymentByIdService(req.params.id as string, req.user!.userId, req.user!.role);
    sendSuccess(res, payment);
  } catch (err) {
    next(err);
  }
};

export const getAllPayments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const result = await getAllPaymentsService({ page, limit, status });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const downloadReceipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filePath = await getReceiptFileService(
      req.params.id as string,
      req.user!.userId,
      req.user!.role,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
};

