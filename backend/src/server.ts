import 'dotenv/config';
import express, { type Request } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import parentRoutes from './routes/parent.routes';
import ledgerRoutes from './routes/ledger.routes';
import paymentRoutes from './routes/payment.routes';
import { razorpayWebhook } from './webhooks/razorpay.webhook';
import { errorHandler, notFound } from './middleware/errorHandler';
import { startMonthlyLedgerJob, startLateFeeJob } from './jobs/ledger.job';

const app = express();
const PORT = process.env.PORT || 5000;

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
  message: 'Too many requests, please try again later.',
});
app.use('/api/', limiter);

// Webhook route — raw body must be preserved for HMAC verification before JSON parsing
app.post('/webhooks/razorpay', express.raw({ type: 'application/json' }), (req, res, next) => {
  (req as Request & { rawBody: string }).rawBody = req.body.toString();
  req.body = JSON.parse((req as Request & { rawBody: string }).rawBody);
  next();
}, razorpayWebhook);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static receipts
app.use('/receipts', express.static(path.resolve(receiptsDir)));

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
  console.log(`\n🚀 School Management Server running on port ${PORT}`);
  console.log(`📚 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL}\n`);

  // Start cron jobs
  startMonthlyLedgerJob();
  startLateFeeJob();
});

export default app;
