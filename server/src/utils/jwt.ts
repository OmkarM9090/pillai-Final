import jwt from 'jsonwebtoken';
import { type Role } from '../config/constants';
import { JWT_EXPIRES_IN } from '../config/constants';

interface TokenPayload {
  userId: string;
  role: Role;
}

export function generateToken(payload: TokenPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return jwt.sign(payload, secret, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload & { iat: number; exp: number } {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return jwt.verify(token, secret) as TokenPayload & { iat: number; exp: number };
}
