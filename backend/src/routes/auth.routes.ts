import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, logout, changePassword } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Tight per-IP limiter on login to mitigate brute-force attacks.
// Window and max are read from env so tests can use a short window.
const loginLimiter = rateLimit({
  windowMs : parseInt(process.env.LOGIN_RATE_WINDOW_MS  || String(60 * 1000), 10), // default 60 s
  max      : parseInt(process.env.LOGIN_RATE_MAX        || '10',              10), // default 10
  standardHeaders: true,
  legacyHeaders  : false,
  message  : 'Too many login attempts. Please try again later.',
});

router.post('/login', loginLimiter, login);
router.post('/logout', authenticate, logout);
router.post('/change-password', authenticate, changePassword);

export default router;
