import { z } from 'zod';
import { ALL_ROLES, DEPARTMENTS } from '../config/constants';

// ============================================================
// Auth validators (Zod v4 compatible)
// ============================================================
export const registerSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must not exceed 100 characters')
      .trim(),
    email: z
      .string()
      .email('Please provide a valid email address')
      .toLowerCase()
      .trim(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password must not exceed 72 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      ),
    role: z
      .enum([...ALL_ROLES] as [string, ...string[]])
      .optional(),
    department: z
      .string()
      .refine(
        (val) => (DEPARTMENTS as readonly string[]).includes(val),
        'Invalid department'
      )
      .optional(),
    phone: z
      .string()
      .regex(/^[+\d\s\-().]{7,20}$/, 'Please provide a valid phone number')
      .optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email('Please provide a valid email address')
      .toLowerCase()
      .trim(),
    password: z.string().min(1, 'Password is required'),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
