import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUserDocument } from '../models/User';
import { ROLE_PERMISSIONS, Permission, type Role } from '../config/constants';
import { sendError } from '../utils/response';

// ============================================================
// Augment Express Request to carry authenticated user
// ============================================================
declare global {
  namespace Express {
    interface Request {
      user?: IUserDocument;
    }
  }
}

interface JwtPayload {
  userId: string;
  role: Role;
  iat: number;
  exp: number;
}

// ============================================================
// Authentication middleware - validates JWT from Authorization header
// ============================================================
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendError(res, 'Authentication required. Please provide a valid token.', 401);
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      sendError(res, 'Authentication token is missing.', 401);
      return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      sendError(res, 'Server configuration error.', 500);
      return;
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, secret) as JwtPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        sendError(res, 'Your session has expired. Please log in again.', 401);
        return;
      }
      sendError(res, 'Invalid authentication token.', 401);
      return;
    }

    const user = await User.findById(decoded.userId).select('-passwordHash');
    if (!user) {
      sendError(res, 'User not found. Token may be stale.', 401);
      return;
    }

    if (!user.isActive) {
      sendError(res, 'Your account has been deactivated. Contact an administrator.', 403);
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

// ============================================================
// Role authorization middleware
// ============================================================
export function authorize(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendError(
        res,
        `Access denied. Required role(s): ${allowedRoles.join(', ')}. Your role: ${req.user.role}`,
        403
      );
      return;
    }

    next();
  };
}

// ============================================================
// Permission-based authorization middleware
// ============================================================
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const userPermissions = ROLE_PERMISSIONS[req.user.role] ?? [];
    if (!userPermissions.includes(permission)) {
      sendError(
        res,
        `Access denied. Permission required: ${permission}`,
        403
      );
      return;
    }

    next();
  };
}
