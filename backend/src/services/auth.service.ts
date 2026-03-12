import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';
import { signToken } from '../utils/jwt';
import { UnauthorizedError, BadRequestError } from '../utils/errors';

export const loginService = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new UnauthorizedError('incorrect password try again');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new UnauthorizedError('incorrect password try again');

  if (user.mustChangePassword) {
    return {
      mustChangePassword: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  const token = signToken({ userId: user.id, role: user.role, email: user.email });
  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
};

export const changePasswordService = async (
  userId: string,
  currentPassword: string,
  newPassword: string
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UnauthorizedError('User not found');

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new BadRequestError('incorrect password try again');

  if (newPassword.length < 6) throw new BadRequestError('Password must be at least 6 characters');

  const hash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hash, mustChangePassword: false },
  });
};
