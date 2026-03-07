import { Router } from 'express';
import {
  getLedgerById,
  getStudentLedgers,
  updateLedger,
  getAllLedgers,
} from '../controllers/ledger.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('ADMIN'), getAllLedgers);
router.get('/:id', getLedgerById);
router.get('/student/:studentId', getStudentLedgers);
router.patch('/:id', requireRole('ADMIN'), updateLedger);

export default router;
