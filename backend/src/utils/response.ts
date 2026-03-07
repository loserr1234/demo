import { Response } from 'express';

export const sendSuccess = (
  res: Response,
  data: unknown,
  message = 'Success',
  statusCode = 200
) => {
  res.status(statusCode).json({ success: true, message, data });
};

export const sendError = (
  res: Response,
  message = 'Internal server error',
  statusCode = 500
) => {
  res.status(statusCode).json({ success: false, message });
};
