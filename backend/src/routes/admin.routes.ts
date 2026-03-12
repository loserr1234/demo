import { Router } from 'express';
import {
  getStats,
  createStudent,
  getStudents,
  getStudentById,
  updateStudent,
  updateStudentStatus,
  getAuditLogs,
  getAlerts,
  resolveAlert,
} from '../controllers/admin.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireRole('ADMIN'));

router.get('/stats', getStats);
router.post('/student', createStudent);
router.get('/students', getStudents);
router.get('/student/:id', getStudentById);
router.put('/student/:id', updateStudent);
router.patch('/student/:id/status', updateStudentStatus);
router.get('/audit-logs', getAuditLogs);
router.get('/alerts', getAlerts);
router.patch('/alerts/:id/resolve', resolveAlert);

export default router;
