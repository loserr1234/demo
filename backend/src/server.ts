import 'dotenv/config';
import express, { type Request } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';

import logger from './utils/logger';
import prisma from './config/prisma';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import parentRoutes from './routes/parent.routes';
import ledgerRoutes from './routes/ledger.routes';
import paymentRoutes from './routes/payment.routes';
import { razorpayWebhook } from './webhooks/razorpay.webhook';
import { errorHandler, notFound } from './middleware/errorHandler';
import { requestIdMiddleware } from './middleware/requestId';
import { httpLogger } from './middleware/httpLogger';
import { startMonthlyLedgerJob, startLateFeeJob } from './jobs/ledger.job';
import { startReconciliationJob } from './jobs/reconciliation.job';

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5001;
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${PORT}`;

// Ensure receipts directory exists
const receiptsDir = process.env.RECEIPTS_DIR || './receipts';
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
}

// Security middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  handler: (req, res, _next, options) => {
    logger.warn('Rate limit hit', { ip: req.ip, path: req.path, requestId: req.requestId });
    res.status(options.statusCode).json({ success: false, message: options.message });
  },
});
app.use('/api/', limiter);

// Webhook route — raw body must be preserved for HMAC verification before JSON parsing
app.post('/api/webhooks/razorpay', express.raw({ type: 'application/json' }), (req, res, next) => {
  (req as Request & { rawBody: string }).rawBody = req.body.toString();
  req.body = JSON.parse((req as Request & { rawBody: string }).rawBody);
  next();
}, razorpayWebhook);

app.use(requestIdMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(httpLogger);

// Receipts served via authenticated API endpoint — see payment.routes.ts

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/payments', paymentRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info('Server started', {
    port: PORT,
    env: process.env.NODE_ENV,
    backendUrl: BACKEND_URL,
    frontendUrl: process.env.FRONTEND_URL,
  });

  // Keepalive ping — prevents Neon serverless DB from suspending the connection
  setInterval(async () => {
    await prisma.$queryRaw`SELECT 1`.catch(() => { });
  }, 4 * 60 * 1000); // every 4 minutes

  // Start cron jobs
  startMonthlyLedgerJob();
  startLateFeeJob();
  startReconciliationJob();
});

export default app;
