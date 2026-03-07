import { Request, Response, NextFunction } from 'express';
import {
  getChildrenService,
  getStudentForParentService,
  getStudentLedgerForParentService,
  getReceiptForParentService,
} from '../services/parent.service';
import { sendSuccess } from '../utils/response';

export const getChildren = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const children = await getChildrenService(req.user!.userId);
    sendSuccess(res, children);
  } catch (err) {
    next(err);
  }
};

export const getStudentForParent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const student = await getStudentForParentService(req.params.id as string, req.user!.userId);
    sendSuccess(res, student);
  } catch (err) {
    next(err);
  }
};

export const getStudentLedger = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ledgers = await getStudentLedgerForParentService(req.params.id as string, req.user!.userId);
    sendSuccess(res, ledgers);
  } catch (err) {
    next(err);
  }
};

export const getReceipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const receipt = await getReceiptForParentService(req.params.paymentId as string, req.user!.userId);
    sendSuccess(res, receipt);
  } catch (err) {
    next(err);
  }
};
