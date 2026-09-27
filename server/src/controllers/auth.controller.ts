import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { generateToken } from '../utils/jwt';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { ROLES } from '../config/constants';

// ============================================================
// POST /api/auth/register
// ============================================================
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, email, password, role, department, phone } = req.body;

    // Check for existing user
    const existing = await User.findOne({ email });
    if (existing) {
      sendError(res, 'An account with this email address already exists.', 409);
      return;
    }

    // Only SUPER_ADMIN can register roles above STAFF directly
    // For public registration, enforce GUEST or STAFF default
    const assignedRole =
      req.user?.role === ROLES.SUPER_ADMIN || req.user?.role === ROLES.GENERAL_MANAGER
        ? role ?? ROLES.STAFF
        : ROLES.STAFF;

    const user = new User({
      name,
      email,
      passwordHash: password, // pre-save hook will hash it
      role: assignedRole,
      department,
      phone,
    });

    await user.save();

    const token = generateToken({ userId: user._id.toString(), role: user.role });

    sendCreated(
      res,
      {
        token,
        user: user.toSafeJSON(),
      },
      'Account created successfully'
    );
  } catch (error) {
    next(error);
  }
}

// ============================================================
// POST /api/auth/login
// ============================================================
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;

    // Include passwordHash for comparison (normally excluded)
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      sendError(res, 'Invalid email or password.', 401);
      return;
    }

    if (!user.isActive) {
      sendError(res, 'Your account has been deactivated. Please contact an administrator.', 403);
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      sendError(res, 'Invalid email or password.', 401);
      return;
    }

    // Update lastLoginAt
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken({ userId: user._id.toString(), role: user.role });

    sendSuccess(
      res,
      {
        token,
        user: user.toSafeJSON(),
      },
      'Login successful'
    );
  } catch (error) {
    next(error);
  }
}

// ============================================================
// GET /api/auth/me
// ============================================================
export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Not authenticated.', 401);
      return;
    }

    sendSuccess(res, { user: req.user.toSafeJSON() }, 'User profile retrieved');
  } catch (error) {
    next(error);
  }
}

// ============================================================
// POST /api/auth/logout
// ============================================================
export async function logout(_req: Request, res: Response): Promise<void> {
  // JWT is stateless - client should discard the token
  // In future, can maintain a token blacklist (Redis)
  sendSuccess(res, null, 'Logged out successfully');
}
