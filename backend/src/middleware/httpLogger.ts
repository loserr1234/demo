import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/**
 * Logs every HTTP request: method, path, status code and response time.
 * Replaces morgan. Must be registered AFTER requestIdMiddleware.
 */
export const httpLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const meta = {
      method:     req.method,
      path:       req.path,
      status:     res.statusCode,
      durationMs,
      ip:         req.ip,
      userAgent:  req.headers['user-agent'],
    };

    const level =
      res.statusCode >= 500 ? 'error' :
      res.statusCode >= 400 ? 'warn'  : 'info';

    logger[level](`${req.method} ${req.path} ${res.statusCode} ${durationMs}ms`, meta);
  });

  next();
};
