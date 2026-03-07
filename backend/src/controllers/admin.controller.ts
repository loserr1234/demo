import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  getStatsService,
  createStudentService,
  getStudentsService,
  getStudentByIdService,
  updateStudentService,
  updateStudentStatusService,
  getAuditLogsService,
} from '../services/admin.service';
import { sendSuccess } from '../utils/response';
import { BadRequestError } from '../utils/errors';

const createStudentSchema = z.object({
  name: z.string().min(1),
  admissionNumber: z.string().min(1),
  class: z.string().min(1),
  section: z.string().min(1),
  parentName: z.string().min(1),
  parentEmail: z.string().email(),
  parentPhone: z.string().min(10),
  admissionDate: z.string(),
});

const updateStudentSchema = z.object({
  name: z.string().optional(),
  class: z.string().optional(),
  section: z.string().optional(),
  admissionDate: z.string().optional(),
});

export const getStats = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await getStatsService();
    sendSuccess(res, stats);
  } catch (err) {
    next(err);
  }
};

export const createStudent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createStudentSchema.parse(req.body);
    const student = await createStudentService(data);
    sendSuccess(res, student, 'Student created successfully', 201);
  } catch (err) {
    if (err instanceof z.ZodError) return next(new BadRequestError(err.errors[0].message));
    next(err);
  }
};

export const getStudents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const cls = typeof req.query.class === 'string' ? req.query.class : undefined;
    const result = await getStudentsService({ page, limit, search, status, class: cls });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const getStudentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const student = await getStudentByIdService(req.params.id as string);
    sendSuccess(res, student);
  } catch (err) {
    next(err);
  }
};

export const updateStudent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateStudentSchema.parse(req.body);
    const student = await updateStudentService(req.params.id as string, data, req.user!.userId);
    sendSuccess(res, student, 'Student updated successfully');
  } catch (err) {
    if (err instanceof z.ZodError) return next(new BadRequestError(err.errors[0].message));
    next(err);
  }
};

export const updateStudentStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      throw new BadRequestError('Invalid status');
    }
    const student = await updateStudentStatusService(req.params.id as string, status, req.user!.userId);
    sendSuccess(res, student, 'Status updated successfully');
  } catch (err) {
    next(err);
  }
};

export const getAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await getAuditLogsService(page, limit);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};
