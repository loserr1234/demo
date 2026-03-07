import { Router } from 'express';
import {
  createOrder,
  recordManualPayment,
  getPaymentById,
  getAllPayments,
} from '../controllers/payment.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.post('/create-order', createOrder);
router.post('/manual', requireRole('ADMIN'), recordManualPayment);
router.get('/', requireRole('ADMIN'), getAllPayments);
router.get('/:id', getPaymentById);

export default router;
