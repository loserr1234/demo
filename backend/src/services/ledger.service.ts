import type { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors';

export const getLedgerByIdService = async (id: string, userId: string, userRole: string) => {
  const ledger = await prisma.ledger.findUnique({
    where: { id },
    include: {
      student: { include: { parent: { select: { id: true, name: true, email: true } } } },
      payments: { include: { receipt: true }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!ledger) throw new NotFoundError('Ledger not found');
  if (userRole === 'PARENT' && ledger.student.parentId !== userId) {
    throw new ForbiddenError('Access denied');
  }
  return ledger;
};

export const getStudentLedgersService = async (studentId: string, userId: string, userRole: string) => {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new NotFoundError('Student not found');
  if (userRole === 'PARENT' && student.parentId !== userId) {
    throw new ForbiddenError('Access denied');
  }

  const ledgers = await prisma.ledger.findMany({
    where: { studentId },
    include: {
      payments: { where: { status: 'SUCCESS' }, select: { amountPaid: true } },
    },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });

  return ledgers.map((l) => {
    const totalPaid = l.payments.reduce((sum, p) => sum + Number(p.amountPaid), 0);
    return { ...l, totalPaid, remaining: Number(l.totalAmount) - totalPaid };
  });
};

export const updateLedgerService = async (
  id: string,
  data: Partial<{ baseAmount: number; lateFee: number; dueDate: string; status: string }>,
  adminId: string
) => {
  const ledger = await prisma.ledger.findUnique({ where: { id } });
  if (!ledger) throw new NotFoundError('Ledger not found');
  if (ledger.status === 'PAID') throw new BadRequestError('Cannot edit a paid ledger');

  const updateData: Record<string, unknown> = {};
  if (data.baseAmount !== undefined) {
    updateData.baseAmount = data.baseAmount;
    updateData.totalAmount = data.baseAmount + (data.lateFee ?? Number(ledger.lateFee));
  }
  if (data.lateFee !== undefined) {
    updateData.lateFee = data.lateFee;
    updateData.totalAmount = (data.baseAmount ?? Number(ledger.baseAmount)) + data.lateFee;
  }
  if (data.dueDate) updateData.dueDate = new Date(data.dueDate);
  if (data.status) updateData.status = data.status;

  const updated = await prisma.ledger.update({ where: { id }, data: updateData });

  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: 'UPDATE_LEDGER',
      entityType: 'Ledger',
      entityId: id,
      oldValue: ledger as unknown as Prisma.InputJsonValue,
      newValue: updateData as Prisma.InputJsonValue,
    },
  });

  return updated;
};

export const getAllLedgersService = async (params: {
  page: number;
  limit: number;
  status?: string;
  month?: number;
  year?: number;
}) => {
  const { page, limit, status, month, year } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (month) where.month = month;
  if (year) where.year = year;

  const [ledgers, total] = await Promise.all([
    prisma.ledger.findMany({
      where,
      skip,
      take: limit,
      include: {
        student: { select: { name: true, admissionNumber: true, class: true, section: true } },
        payments: { where: { status: 'SUCCESS' }, select: { amountPaid: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    }),
    prisma.ledger.count({ where }),
  ]);

  const enriched = ledgers.map((l) => {
    const totalPaid = l.payments.reduce((sum, p) => sum + Number(p.amountPaid), 0);
    return { ...l, totalPaid, remaining: Number(l.totalAmount) - totalPaid };
  });

  return { ledgers: enriched, total, page, limit, totalPages: Math.ceil(total / limit) };
};
