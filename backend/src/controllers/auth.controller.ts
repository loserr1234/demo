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

const isProduction = process.env.NODE_ENV === 'production';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await loginService(email, password);

    if ('mustChangePassword' in result && result.mustChangePassword) {
      return sendSuccess(res, {
        mustChangePassword: true,
        user: result.user,
      }, 'Password change required');
    }

    // Set JWT as httpOnly cookie
    res.cookie('school_token', result.token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });

    sendSuccess(res, { user: result.user }, 'Login successful');
  } catch (err) {
    if (err instanceof z.ZodError) return next(new BadRequestError(err.errors[0].message));
    next(err);
  }
};

export const logout = (_req: Request, res: Response) => {
  res.clearCookie('school_token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
  });
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
