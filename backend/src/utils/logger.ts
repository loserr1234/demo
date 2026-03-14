import winston from 'winston';
import 'winston-daily-rotate-file';
import { AsyncLocalStorage } from 'async_hooks';
import path from 'path';

// ── Request context (propagated via AsyncLocalStorage) ──────────────────────
export interface RequestContext {
  requestId: string;
  userId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

// ── Custom format: injects requestId/userId from async context ───────────────
const injectContext = winston.format((info) => {
  const ctx = requestContext.getStore();
  if (ctx?.requestId) info.requestId = ctx.requestId;
  if (ctx?.userId)    info.userId    = ctx.userId;
  return info;
});

// ── Development: pretty, colorised, single-line ──────────────────────────────
const devFormat = winston.format.combine(
  injectContext(),
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, requestId, userId, ...rest }) => {
    const ctx = [
      requestId && `req=${requestId}`,
      userId    && `user=${userId}`,
    ].filter(Boolean).join(' ');
    const metaStr = Object.keys(rest).length ? ' ' + JSON.stringify(rest) : '';
    return `${timestamp} [${level}]${ctx ? ` [${ctx}]` : ''} ${message}${metaStr}`;
  }),
);

// ── Production: JSON, machine-readable ───────────────────────────────────────
const prodFormat = winston.format.combine(
  injectContext(),
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// ── Transports ───────────────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV !== 'production';

const transports: winston.transport[] = [];

if (isDev) {
  transports.push(new winston.transports.Console({ format: devFormat }));
} else {
  const logsDir = process.env.LOGS_DIR || './logs';

  // Combined log (info+)
  transports.push(
    new winston.transports.DailyRotateFile({
      filename:    path.join(logsDir, 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles:    '14d',
      format:      prodFormat,
      level:       'info',
    }),
  );

  // Error-only log
  transports.push(
    new winston.transports.DailyRotateFile({
      filename:    path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles:    '14d',
      format:      prodFormat,
      level:       'error',
    }),
  );
}

const logger = winston.createLogger({
  level:      isDev ? 'debug' : 'info',
  transports,
});

export default logger;
