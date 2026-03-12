import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { NotFoundError, ConflictError } from '../utils/errors';

export const getStatsService = async () => {
  const [
    totalStudents,
    activeStudents,
    totalParents,
    unpaidLedgers,
    paidThisMonth,
    totalRevenue,
  ] = await Promise.all([
    prisma.student.count(),
    prisma.student.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { role: 'PARENT' } }),
    prisma.ledger.count({ where: { status: { in: ['UNPAID', 'PARTIAL'] } } }),
    prisma.payment.aggregate({
      where: {
        status: 'SUCCESS',
        paymentDate: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
      _sum: { amountPaid: true },
    }),
    prisma.payment.aggregate({
      where: { status: 'SUCCESS' },
      _sum: { amountPaid: true },
    }),
  ]);

  return {
    totalStudents,
    activeStudents,
    totalParents,
    unpaidLedgers,
    revenueThisMonth: Number(paidThisMonth._sum.amountPaid || 0),
    totalRevenue: Number(totalRevenue._sum.amountPaid || 0),
  };
};

export const createStudentService = async (data: {
  name: string;
  admissionNumber: string;
  class: string;
  section: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  admissionDate: string;
}) => {
  const existing = await prisma.user.findUnique({ where: { email: data.parentEmail } });

  let parent;
  let tempPassword: string | undefined;
  if (existing) {
    if (existing.role !== 'PARENT') throw new ConflictError('Email belongs to non-parent user');
    parent = existing;
  } else {
    tempPassword = crypto.randomBytes(12).toString('base64url');
    const hash = await bcrypt.hash(tempPassword, 12);
    parent = await prisma.user.create({
      data: {
        name: data.parentName,
        email: data.parentEmail,
        passwordHash: hash,
        role: 'PARENT',
        phone: data.parentPhone,
        mustChangePassword: true,
      },
    });
  }

  const student = await prisma.student.create({
    data: {
      name: data.name,
      admissionNumber: data.admissionNumber,
      class: data.class,
      section: data.section,
      parentId: parent.id,
      admissionDate: new Date(data.admissionDate),
      status: 'ACTIVE',
    },
    include: { parent: { select: { id: true, name: true, email: true, phone: true } } },
  });

  return {
    ...student,
    // Only present when a new parent account was created with a random temp password
    ...(tempPassword ? { tempPassword } : {}),
  };
};

export const getStudentsService = async (params: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  class?: string;
}) => {
  const { page, limit, search, status, class: cls } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (cls) where.class = cls;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { admissionNumber: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      skip,
      take: limit,
      include: { parent: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.student.count({ where }),
  ]);

  return { students, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const getStudentByIdService = async (id: string) => {
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      parent: { select: { id: true, name: true, email: true, phone: true } },
      ledgers: { orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 12 },
    },
  });
  if (!student) throw new NotFoundError('Student not found');
  return student;
};

export const updateStudentService = async (
  id: string,
  data: Partial<{ name: string; class: string; section: string; admissionDate: string }>,
  adminId: string
) => {
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) throw new NotFoundError('Student not found');

  const updated = await prisma.student.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.class && { class: data.class }),
      ...(data.section && { section: data.section }),
      ...(data.admissionDate && { admissionDate: new Date(data.admissionDate) }),
    },
    include: { parent: { select: { id: true, name: true, email: true, phone: true } } },
  });

  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: 'UPDATE_STUDENT',
      entityType: 'Student',
      entityId: id,
      oldValue: student as unknown as Prisma.InputJsonValue,
      newValue: updated as unknown as Prisma.InputJsonValue,
    },
  });

  return updated;
};

export const updateStudentStatusService = async (
  id: string,
  status: 'ACTIVE' | 'INACTIVE',
  adminId: string
) => {
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) throw new NotFoundError('Student not found');

  const updated = await prisma.student.update({
    where: { id },
    data: {
      status,
      ...(status === 'INACTIVE' && { leaveDate: new Date() }),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: `STUDENT_STATUS_${status}`,
      entityType: 'Student',
      entityId: id,
      oldValue: { status: student.status } as Prisma.InputJsonValue,
      newValue: { status } as Prisma.InputJsonValue,
    },
  });

  return updated;
};

export const getAuditLogsService = async (page: number, limit: number) => {
  const skip = (page - 1) * limit;
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true, role: true } } },
    }),
    prisma.auditLog.count(),
  ]);
  return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const getAlertsService = async (resolved: boolean) => {
  return prisma.alert.findMany({
    where: { resolved },
    orderBy: { createdAt: 'desc' },
  });
};

export const resolveAlertService = async (id: string) => {
  return prisma.alert.update({
    where: { id },
    data: { resolved: true },
  });
};
