import { Router } from 'express';
import {
  getChildren,
  getStudentForParent,
  getStudentLedger,
  getReceipt,
} from '../controllers/parent.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireRole('PARENT'));

router.get('/children', getChildren);
router.get('/student/:id', getStudentForParent);
router.get('/student/:id/ledger', getStudentLedger);
router.get('/receipt/:paymentId', getReceipt);

export default router;
