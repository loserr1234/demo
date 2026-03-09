import fs from 'fs';
import path from 'path';
import type { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import razorpay from '../config/razorpay';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors';
import { generateReceiptPDF } from '../utils/receipt';

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

  const totalPaid = ledger.payments.reduce((s, p) => s + p.amountPaid, 0);
  const remaining = ledger.totalAmount - totalPaid;
  return { ledger, totalPaid, remaining };
};

export const createOrderService = async (ledgerId: string, userId: string, userRole: string) => {
  const { ledger, remaining } = await getRemainingAmount(ledgerId);

  if (userRole === 'PARENT') {
    const student = await prisma.student.findUnique({ where: { id: ledger.studentId } });
    if (!student || student.parentId !== userId) throw new ForbiddenError('Access denied');
  }

  if (remaining <= 0) throw new BadRequestError('Ledger is already fully paid');
  if (ledger.status === 'PAID' || ledger.status === 'WAIVED') {
    throw new BadRequestError('Ledger cannot be paid');
  }

  const order = await razorpay.orders.create({
    amount: Math.round(remaining * 100),
    currency: 'INR',
    receipt: `l_${ledgerId.replace(/-/g, '').slice(0, 38)}`,
    notes: { ledgerId, studentId: ledger.studentId },
  });

  return {
    orderId: order.id,
    amount: remaining,
    currency: 'INR',
    keyId: process.env.RAZORPAY_KEY_ID,
    ledgerId,
  };
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
  const { ledger, remaining } = await getRemainingAmount(data.ledgerId);

  if (remaining <= 0) throw new BadRequestError('Ledger is already fully paid');
  if (ledger.status === 'PAID' || ledger.status === 'WAIVED') {
    throw new BadRequestError('Ledger cannot be paid');
  }

  const paymentDate = data.paymentDate ? new Date(data.paymentDate) : new Date();

  const student = await prisma.student.findUnique({ where: { id: ledger.studentId } });
  if (!student) throw new NotFoundError('Student not found');

  const receiptNumber = generateReceiptNumber();
  const receiptUrl = await generateReceiptPDF({
    receiptNumber,
    paymentId: 'pending',
    studentName: student.name,
    admissionNumber: student.admissionNumber,
    class: student.class,
    section: student.section,
    month: ledger.month,
    year: ledger.year,
    amount: remaining,
    paymentDate,
    paymentMethod: data.paymentMethod,
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
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

      const newTotalPaid = (await tx.payment.aggregate({
        where: { ledgerId: data.ledgerId, status: 'SUCCESS' },
        _sum: { amountPaid: true },
      }))._sum.amountPaid || 0;

      const newStatus = newTotalPaid >= ledger.totalAmount ? 'PAID' : 'PARTIAL';
      await tx.ledger.update({ where: { id: data.ledgerId }, data: { status: newStatus } });

      const receipt = await tx.receipt.create({
        data: {
          paymentId: payment.id,
          receiptNumber,
          receiptUrl,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'MANUAL_PAYMENT',
          entityType: 'Payment',
          entityId: payment.id,
          newValue: { amount: remaining, method: data.paymentMethod, ledgerId: data.ledgerId } as Prisma.InputJsonValue,
        },
      });

      return { payment, receipt };
    });

    return result;
  } catch (err) {
    fs.unlink(path.resolve(receiptUrl), () => {});
    throw err;
  }
};

export const getPaymentByIdService = async (id: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      receipt: true,
      ledger: {
        include: {
          student: { select: { name: true, admissionNumber: true, class: true, section: true } },
        },
      },
    },
  });
  if (!payment) throw new NotFoundError('Payment not found');
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
          include: { student: { select: { name: true, admissionNumber: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.payment.count({ where }),
  ]);

  return { payments, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const processWebhookService = async (
  gatewayPaymentId: string,
  orderId: string,
  ledgerId: string,
  amount: number
) => {
  const { ledger, remaining } = await getRemainingAmount(ledgerId);
  if (ledger.status === 'PAID') return { duplicate: true };

  const student = await prisma.student.findUnique({ where: { id: ledger.studentId } });
  if (!student) throw new NotFoundError('Student not found');

  const paymentDate = new Date();
  const receiptNumber = generateReceiptNumber();
  const receiptUrl = await generateReceiptPDF({
    receiptNumber,
    paymentId: 'pending',
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

      const newTotalPaid = (await tx.payment.aggregate({
        where: { ledgerId, status: 'SUCCESS' },
        _sum: { amountPaid: true },
      }))._sum.amountPaid || 0;

      const newStatus = newTotalPaid >= ledger.totalAmount ? 'PAID' : 'PARTIAL';
      await tx.ledger.update({ where: { id: ledgerId }, data: { status: newStatus } });

      await tx.receipt.create({
        data: { paymentId: payment.id, receiptNumber, receiptUrl },
      });

      return { payment, newStatus };
    });

    return { ...result, duplicate: false };
  } catch (err: any) {
    fs.unlink(path.resolve(receiptUrl), () => {});
    if (err.code === 'P2002' && err.meta?.target?.includes('gateway_payment_id')) {
      return { duplicate: true };
    }
    throw err;
  }
};
