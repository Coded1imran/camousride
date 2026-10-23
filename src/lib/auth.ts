import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'campusride-dev-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
}

export function signToken(userId: string, email: string, role: string): string {
  const payload = { userId, email, role };
  const options: jwt.SignOptions = {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  };

  return jwt.sign(payload, JWT_SECRET as jwt.Secret, options);
}

export function verifyToken(token: string): AuthUser & { iat?: number; exp?: number } {
  const decoded = jwt.verify(token, JWT_SECRET);
  return decoded as AuthUser & { iat?: number; exp?: number };
}

export async function getSessionUser(token?: string) {
  if (!token) return null;
  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        phone: true,
        department: true,
        hostel: true,
      },
    });
    if (!user) return null;
    return { ...user, token };
  } catch {
    return null;
  }
}
