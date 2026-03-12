import { Request, Response, NextFunction } from 'express';
import {
  getLedgerByIdService,
  getStudentLedgersService,
  updateLedgerService,
  getAllLedgersService,
} from '../services/ledger.service';
import { sendSuccess } from '../utils/response';

export const getLedgerById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ledger = await getLedgerByIdService(req.params.id as string, req.user!.userId, req.user!.role);
    sendSuccess(res, ledger);
  } catch (err) {
    next(err);
  }
};

export const getStudentLedgers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ledgers = await getStudentLedgersService(req.params.studentId as string, req.user!.userId, req.user!.role);
    sendSuccess(res, ledgers);
  } catch (err) {
    next(err);
  }
};

export const updateLedger = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ledger = await updateLedgerService(req.params.id as string, req.body, req.user!.userId);
    sendSuccess(res, ledger, 'Ledger updated successfully');
  } catch (err) {
    next(err);
  }
};

export const getAllLedgers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const month = typeof req.query.month === 'string' ? parseInt(req.query.month) : undefined;
    const year = typeof req.query.year === 'string' ? parseInt(req.query.year) : undefined;
    const result = await getAllLedgersService({ page, limit, status, month, year });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};
