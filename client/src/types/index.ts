// ============================================================
// Role definitions (mirrors server constants)
// ============================================================
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  GENERAL_MANAGER: 'GENERAL_MANAGER',
  DEPARTMENT_HEAD: 'DEPARTMENT_HEAD',
  SUPERVISOR: 'SUPERVISOR',
  STAFF: 'STAFF',
  CHEF: 'CHEF',
  FRONT_DESK: 'FRONT_DESK',
  HOUSEKEEPING: 'HOUSEKEEPING',
  MAINTENANCE: 'MAINTENANCE',
  INVENTORY_MANAGER: 'INVENTORY_MANAGER',
  VENDOR_MANAGER: 'VENDOR_MANAGER',
  SECURITY: 'SECURITY',
  FINANCE: 'FINANCE',
  HR: 'HR',
  GUEST: 'GUEST',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const PERMISSIONS = {
  VIEW: 'view',
  CREATE: 'create',
  UPDATE: 'update',
  APPROVE: 'approve',
  ASSIGN: 'assign',
  RESOLVE: 'resolve',
  CANCEL: 'cancel',
  MANAGE: 'manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ============================================================
// User type
// ============================================================
export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
  department?: string;
  phone?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// API Response types
// ============================================================
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: Array<{ field?: string; message: string }>;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================================
// Auth types
// ============================================================
export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
  role?: Role;
  department?: string;
  phone?: string;
}

// ============================================================
// Permission map per role (client-side gate)
// ============================================================
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: Object.values(PERMISSIONS),
  GENERAL_MANAGER: ['view', 'create', 'update', 'approve', 'assign', 'resolve', 'cancel', 'manage'],
  DEPARTMENT_HEAD: ['view', 'create', 'update', 'approve', 'assign', 'resolve', 'cancel'],
  SUPERVISOR: ['view', 'create', 'update', 'assign', 'resolve'],
  STAFF: ['view', 'create', 'update'],
  CHEF: ['view', 'create', 'update'],
  FRONT_DESK: ['view', 'create', 'update', 'resolve'],
  HOUSEKEEPING: ['view', 'update', 'resolve'],
  MAINTENANCE: ['view', 'update', 'resolve'],
  INVENTORY_MANAGER: ['view', 'create', 'update', 'approve', 'manage'],
  VENDOR_MANAGER: ['view', 'create', 'update', 'approve', 'manage'],
  SECURITY: ['view', 'create', 'update', 'resolve'],
  FINANCE: ['view', 'create', 'update', 'approve', 'manage'],
  HR: ['view', 'create', 'update', 'approve', 'manage'],
  GUEST: ['view', 'create'],
};

// ============================================================
// Role display labels
// ============================================================
export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  GENERAL_MANAGER: 'General Manager',
  DEPARTMENT_HEAD: 'Department Head',
  SUPERVISOR: 'Supervisor',
  STAFF: 'Staff',
  CHEF: 'Chef',
  FRONT_DESK: 'Front Desk',
  HOUSEKEEPING: 'Housekeeping',
  MAINTENANCE: 'Maintenance',
  INVENTORY_MANAGER: 'Inventory Manager',
  VENDOR_MANAGER: 'Vendor Manager',
  SECURITY: 'Security',
  FINANCE: 'Finance',
  HR: 'Human Resources',
  GUEST: 'Guest',
};
