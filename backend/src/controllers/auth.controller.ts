import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { loginService, changePasswordService } from '../services/auth.service';
import { sendSuccess } from '../utils/response';
import { BadRequestError } from '../utils/errors';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await loginService(email, password);
    sendSuccess(res, result, 'Login successful');
  } catch (err) {
    if (err instanceof z.ZodError) return next(new BadRequestError(err.errors[0].message));
    next(err);
  }
};

export const logout = (_req: Request, res: Response) => {
  sendSuccess(res, null, 'Logged out successfully');
};

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    await changePasswordService(req.user!.userId, currentPassword, newPassword);
    sendSuccess(res, null, 'Password changed successfully');
  } catch (err) {
    if (err instanceof z.ZodError) return next(new BadRequestError(err.errors[0].message));
    next(err);
  }
};
