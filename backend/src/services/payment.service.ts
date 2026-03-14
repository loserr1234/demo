import fs from 'fs';
import path from 'path';
import type { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import razorpay from '../config/razorpay';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors';
import { generateReceiptPDF } from '../utils/receipt';
import logger from '../utils/logger';

const generateReceiptNumber = () => {
  const now = new Date();
  const prefix = `RCP${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `${prefix}${random}`;
};

const getRemainingAmount = async (ledgerId: string) => {
  const ledger = await prisma.ledger.findUnique({
    where: { id: ledgerId },
    include: { payments: { where: { status: 'SUCCESS' } } },
  });

  if (!ledger) throw new NotFoundError('Ledger not found');

  const totalPaid = ledger.payments.reduce((s, p) => s + Number(p.amountPaid), 0);
  const remaining = Number(ledger.totalAmount) - totalPaid;

  return { ledger, totalPaid, remaining };
};

const PENDING_ORDER_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const createOrderService = async (
  ledgerId: string,
  userId: string,
  userRole: string
) => {
  // Ownership check (lightweight, outside transaction)
  if (userRole === 'PARENT') {
    const ledger = await prisma.ledger.findUnique({
      where: { id: ledgerId },
      include: { student: true },
    });
    if (!ledger) throw new NotFoundError('Ledger not found');
    if (ledger.student.parentId !== userId) {
      throw new ForbiddenError('Access denied');
    }
  }

  // Everything else inside the serialized transaction
  const result = await prisma.$transaction(async (tx) => {
    // Lock the ledger row — other concurrent transactions will block here
    const [locked] = await tx.$queryRawUnsafe<Array<{
      id: string;
      student_id: string;
      total_amount: number;
      pending_order_id: string | null;
      pending_order_created_at: Date | null;
      status: string;
    }>>(
      `SELECT id, student_id, total_amount, pending_order_id, pending_order_created_at, status
       FROM ledgers WHERE id = $1 FOR UPDATE`,
      ledgerId,
    );

    if (!locked) throw new NotFoundError('Ledger not found');

    if (locked.status === 'PAID' || locked.status === 'WAIVED') {
      throw new BadRequestError('Ledger cannot be paid');
    }

    // Compute remaining inside the lock
    const paidAgg = await tx.payment.aggregate({
      where: { ledgerId, status: 'SUCCESS' },
      _sum: { amountPaid: true },
    });
    const totalPaid = paidAgg._sum.amountPaid || 0;
    const remaining = Number(locked.total_amount) - Number(totalPaid);

    if (remaining <= 0) {
      throw new BadRequestError('Ledger is already fully paid');
    }

    // Reuse existing pending order if still fresh
    if (
      locked.pending_order_id &&
      locked.pending_order_created_at &&
      Date.now() - new Date(locked.pending_order_created_at).getTime() < PENDING_ORDER_TTL_MS
    ) {
      return {
        orderId: locked.pending_order_id,
        amount: remaining,
        currency: 'INR' as const,
        keyId: process.env.RAZORPAY_KEY_ID,
        ledgerId,
      };
    }

    // No valid pending order — create a new Razorpay order
    const order = await razorpay.orders.create({
      amount: Math.round(remaining * 100),
      currency: 'INR',
      receipt: `l_${ledgerId.replace(/-/g, '').slice(0, 38)}`,
      notes: {
        ledgerId,
        studentId: locked.student_id,
      },
    });

    // Store the pending order atomically (still holding the row lock)
    await tx.ledger.update({
      where: { id: ledgerId },
      data: {
        pendingOrderId: order.id,
        pendingOrderCreatedAt: new Date(),
      },
    });

    logger.info('Payment order created', { orderId: order.id, ledgerId, amount: remaining });
    return {
      orderId: order.id,
      amount: remaining,
      currency: 'INR' as const,
      keyId: process.env.RAZORPAY_KEY_ID,
      ledgerId,
    };
  });

  return result;
};

export const recordManualPaymentService = async (
  data: {
    ledgerId: string;
    paymentMethod: 'CASH' | 'UPI' | 'BANK';
    referenceNumber?: string;
    paymentDate?: string;
  },
  adminId: string
) => {
  const paymentDate = data.paymentDate
    ? new Date(data.paymentDate)
    : new Date();

  // Pre-fetch student for receipt generation (read-only, safe outside lock)
  const ledgerForStudent = await prisma.ledger.findUnique({
    where: { id: data.ledgerId },
    include: { student: true },
  });
  if (!ledgerForStudent) throw new NotFoundError('Ledger not found');
  const student = ledgerForStudent.student;

  // Generate receipt PDF before transaction (will clean up on failure)
  let receiptUrl: string | null = null;
  let receiptNumber: string | null = null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Lock the ledger row to prevent concurrent manual payments
      const [locked] = await tx.$queryRawUnsafe<Array<{
        id: string;
        student_id: string;
        month: number;
        year: number;
        base_amount: number;
        total_amount: number;
        status: string;
      }>>(
        `SELECT id, student_id, month, year, base_amount, total_amount, status
         FROM ledgers WHERE id = $1 FOR UPDATE`,
        data.ledgerId,
      );

      if (!locked) throw new NotFoundError('Ledger not found');

      if (locked.status === 'PAID' || locked.status === 'WAIVED') {
        throw new BadRequestError('Ledger cannot be paid');
      }

      // Compute remaining inside the lock
      const paidAgg = await tx.payment.aggregate({
        where: { ledgerId: data.ledgerId, status: 'SUCCESS' },
        _sum: { amountPaid: true },
      });
      const totalPaid = Number(paidAgg._sum.amountPaid || 0);
      const remaining = Number(locked.total_amount) - totalPaid;

      if (remaining <= 0) {
        throw new BadRequestError('Ledger is already fully paid');
      }

      // Generate receipt now that we have the verified remaining amount
      receiptNumber = generateReceiptNumber();
      receiptUrl = await generateReceiptPDF({
        receiptNumber,
        paymentId: data.referenceNumber || 'MANUAL',
        studentName: student.name,
        admissionNumber: student.admissionNumber,
        class: student.class,
        section: student.section,
        month: locked.month,
        year: locked.year,
        amount: remaining,
        paymentDate,
        paymentMethod: data.paymentMethod,
      });

      const payment = await tx.payment.create({
        data: {
          ledgerId: data.ledgerId,
          amountPaid: remaining,
          paymentMethod: data.paymentMethod,
          source: 'MANUAL',
          referenceNumber: data.referenceNumber,
          paymentDate,
          status: 'SUCCESS',
        },
      });

      const newTotalPaid =
        (
          await tx.payment.aggregate({
            where: { ledgerId: data.ledgerId, status: 'SUCCESS' },
            _sum: { amountPaid: true },
          })
        )._sum.amountPaid || 0;

      const newStatus =
        Number(newTotalPaid) >= Number(locked.total_amount) ? 'PAID' : 'PARTIAL';

      await tx.ledger.update({
        where: { id: data.ledgerId },
        data: { status: newStatus },
      });

      const receipt = await tx.receipt.create({
        data: {
          paymentId: payment.id,
          receiptNumber,
          receiptUrl,
        },
      });

      logger.info('Manual payment recorded, ledger updated', {
        paymentId: payment.id,
        ledgerId: data.ledgerId,
        amount: remaining,
        method: data.paymentMethod,
        newStatus,
        adminId,
      });

      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'MANUAL_PAYMENT',
          entityType: 'Payment',
          entityId: payment.id,
          newValue: {
            amount: remaining,
            method: data.paymentMethod,
            ledgerId: data.ledgerId,
          } as Prisma.InputJsonValue,
        },
      });

      return { payment, receipt };
    });

    return result;
  } catch (err) {
    if (receiptUrl) {
      fs.unlink(path.resolve(receiptUrl), () => { });
    }
    throw err;
  }
};

export const getPaymentByIdService = async (id: string, userId: string, userRole: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      receipt: true,
      ledger: {
        include: {
          student: {
            select: {
              name: true,
              admissionNumber: true,
              class: true,
              section: true,
              parentId: true,
            },
          },
        },
      },
    },
  });

  if (!payment) throw new NotFoundError('Payment not found');

  if (userRole === 'PARENT' && payment.ledger.student.parentId !== userId) {
    throw new ForbiddenError('Access denied');
  }

  return payment;
};

export const getAllPaymentsService = async (params: {
  page: number;
  limit: number;
  status?: string;
}) => {
  const { page, limit, status } = params;

  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      include: {
        receipt: true,
        ledger: {
          include: {
            student: {
              select: {
                name: true,
                admissionNumber: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    payments,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

export const getReceiptFileService = async (
  paymentId: string,
  userId: string,
  userRole: string,
): Promise<string> => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      receipt: true,
      ledger: { include: { student: true } },
    },
  });

  if (!payment) throw new NotFoundError('Payment not found');
  if (!payment.receipt) throw new NotFoundError('Receipt not found');

  if (userRole === 'PARENT' && payment.ledger.student.parentId !== userId) {
    throw new ForbiddenError('Access denied');
  }

  const receiptsDir = process.env.RECEIPTS_DIR || './receipts';
  const fileName = path.basename(payment.receipt.receiptUrl);
  const filePath = path.resolve(receiptsDir, fileName);

  if (!fs.existsSync(filePath)) {
    throw new NotFoundError('Receipt file not found on disk');
  }

  return filePath;
};

export const processWebhookService = async (
  gatewayPaymentId: string,
  orderId: string,
  ledgerId: string,
  amount: number
) => {
  const { ledger } = await getRemainingAmount(ledgerId);

  if (ledger.status === 'PAID') {
    return { duplicate: true };
  }

  const student = await prisma.student.findUnique({
    where: { id: ledger.studentId },
  });

  if (!student) throw new NotFoundError('Student not found');

  const paymentDate = new Date();
  const receiptNumber = generateReceiptNumber();

  const receiptUrl = await generateReceiptPDF({
    receiptNumber,
    paymentId: gatewayPaymentId,
    studentName: student.name,
    admissionNumber: student.admissionNumber,
    class: student.class,
    section: student.section,
    month: ledger.month,
    year: ledger.year,
    amount: amount / 100,
    paymentDate,
    paymentMethod: 'RAZORPAY',
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          ledgerId,
          amountPaid: amount / 100,
          paymentMethod: 'RAZORPAY',
          source: 'ONLINE',
          gatewayPaymentId,
          referenceNumber: orderId,
          paymentDate,
          status: 'SUCCESS',
        },
      });

      const newTotalPaid = Number(
        (
          await tx.payment.aggregate({
            where: { ledgerId, status: 'SUCCESS' },
            _sum: { amountPaid: true },
          })
        )._sum.amountPaid || 0,
      );

      const newStatus =
        newTotalPaid >= Number(ledger.totalAmount) ? 'PAID' : 'PARTIAL';

      await tx.ledger.update({
        where: { id: ledgerId },
        data: {
          status: newStatus,
          pendingOrderId: null,
          pendingOrderCreatedAt: null,
        },
      });

      const receipt = await tx.receipt.create({
        data: {
          paymentId: payment.id,
          receiptNumber,
          receiptUrl,
        },
      });

      return { payment, newStatus, receipt };
    });

    logger.info('Online payment recorded, ledger updated', {
      paymentId: result.payment.id,
      gatewayPaymentId,
      ledgerId,
      amount: amount / 100,
      newStatus: result.newStatus,
    });

    return { ...result, duplicate: false };
  } catch (err: any) {
    fs.unlink(path.resolve(receiptUrl), () => { });

    if (
      err.code === 'P2002' &&
      err.meta?.target?.includes('gateway_payment_id')
    ) {
      return { duplicate: true };
    }

    logger.error('Payment processing failed', { gatewayPaymentId, ledgerId, error: (err as Error).message });
    throw err;
  }
};

