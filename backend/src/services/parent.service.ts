import prisma from '../config/prisma';
import { NotFoundError, ForbiddenError } from '../utils/errors';

export const getChildrenService = async (parentId: string) => {
  return prisma.student.findMany({
    where: { parentId },
    include: {
      ledgers: {
        where: { status: { in: ['UNPAID', 'PARTIAL'] } },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 1,
      },
    },
    orderBy: { createdAt: 'asc' },
  });
};

export const getStudentForParentService = async (studentId: string, parentId: string) => {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { parent: { select: { id: true, name: true, email: true, phone: true } } },
  });
  if (!student) throw new NotFoundError('Student not found');
  if (student.parentId !== parentId) throw new ForbiddenError('Access denied');
  return student;
};

export const getStudentLedgerForParentService = async (studentId: string, parentId: string) => {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new NotFoundError('Student not found');
  if (student.parentId !== parentId) throw new ForbiddenError('Access denied');

  const ledgers = await prisma.ledger.findMany({
    where: { studentId },
    include: {
      payments: {
        where: { status: 'SUCCESS' },
        include: { receipt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });

  return ledgers.map((l) => {
    const totalPaid = l.payments.reduce((sum, p) => sum + Number(p.amountPaid), 0);
    return { ...l, totalPaid, remaining: Number(l.totalAmount) - totalPaid };
  });
};

export const getReceiptForParentService = async (paymentId: string, parentId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      receipt: true,
      ledger: { include: { student: true } },
    },
  });

  if (!payment) throw new NotFoundError('Payment not found');
  if (payment.ledger.student.parentId !== parentId) throw new ForbiddenError('Access denied');
  if (!payment.receipt) throw new NotFoundError('Receipt not found');

  return payment.receipt;
};
