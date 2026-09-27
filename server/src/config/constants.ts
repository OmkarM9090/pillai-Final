// ============================================================
// ROLES
// ============================================================
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  GENERAL_MANAGER: 'GENERAL_MANAGER',
  MANAGER: 'MANAGER',
  DEPARTMENT_HEAD: 'DEPARTMENT_HEAD',
  SUPERVISOR: 'SUPERVISOR',
  STAFF: 'STAFF',
  WORKER: 'WORKER',
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

export const ALL_ROLES: Role[] = Object.values(ROLES);

// ============================================================
// PERMISSIONS - Reusable foundation for future modules
// ============================================================
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
// Role → Permission mapping (foundation for RBAC)
// Modules can import this and extend with module-specific rules
// ============================================================
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: Object.values(PERMISSIONS),
  GENERAL_MANAGER: [
    PERMISSIONS.VIEW,
    PERMISSIONS.CREATE,
    PERMISSIONS.UPDATE,
    PERMISSIONS.APPROVE,
    PERMISSIONS.ASSIGN,
    PERMISSIONS.RESOLVE,
    PERMISSIONS.CANCEL,
    PERMISSIONS.MANAGE,
  ],
  MANAGER: [
    PERMISSIONS.VIEW,
    PERMISSIONS.CREATE,
    PERMISSIONS.UPDATE,
    PERMISSIONS.APPROVE,
    PERMISSIONS.ASSIGN,
    PERMISSIONS.RESOLVE,
    PERMISSIONS.CANCEL,
  ],
  DEPARTMENT_HEAD: [
    PERMISSIONS.VIEW,
    PERMISSIONS.CREATE,
    PERMISSIONS.UPDATE,
    PERMISSIONS.APPROVE,
    PERMISSIONS.ASSIGN,
    PERMISSIONS.RESOLVE,
    PERMISSIONS.CANCEL,
  ],
  SUPERVISOR: [
    PERMISSIONS.VIEW,
    PERMISSIONS.CREATE,
    PERMISSIONS.UPDATE,
    PERMISSIONS.ASSIGN,
    PERMISSIONS.RESOLVE,
  ],
  STAFF: [PERMISSIONS.VIEW, PERMISSIONS.CREATE, PERMISSIONS.UPDATE],
  WORKER: [PERMISSIONS.VIEW, PERMISSIONS.CREATE, PERMISSIONS.UPDATE, PERMISSIONS.RESOLVE],
  CHEF: [PERMISSIONS.VIEW, PERMISSIONS.CREATE, PERMISSIONS.UPDATE],
  FRONT_DESK: [PERMISSIONS.VIEW, PERMISSIONS.CREATE, PERMISSIONS.UPDATE, PERMISSIONS.RESOLVE],
  HOUSEKEEPING: [PERMISSIONS.VIEW, PERMISSIONS.UPDATE, PERMISSIONS.RESOLVE],
  MAINTENANCE: [PERMISSIONS.VIEW, PERMISSIONS.UPDATE, PERMISSIONS.RESOLVE],
  INVENTORY_MANAGER: [
    PERMISSIONS.VIEW,
    PERMISSIONS.CREATE,
    PERMISSIONS.UPDATE,
    PERMISSIONS.APPROVE,
    PERMISSIONS.MANAGE,
  ],
  VENDOR_MANAGER: [
    PERMISSIONS.VIEW,
    PERMISSIONS.CREATE,
    PERMISSIONS.UPDATE,
    PERMISSIONS.APPROVE,
    PERMISSIONS.MANAGE,
  ],
  SECURITY: [PERMISSIONS.VIEW, PERMISSIONS.CREATE, PERMISSIONS.UPDATE, PERMISSIONS.RESOLVE],
  FINANCE: [
    PERMISSIONS.VIEW,
    PERMISSIONS.CREATE,
    PERMISSIONS.UPDATE,
    PERMISSIONS.APPROVE,
    PERMISSIONS.MANAGE,
  ],
  HR: [
    PERMISSIONS.VIEW,
    PERMISSIONS.CREATE,
    PERMISSIONS.UPDATE,
    PERMISSIONS.APPROVE,
    PERMISSIONS.MANAGE,
  ],
  GUEST: [PERMISSIONS.VIEW, PERMISSIONS.CREATE],
};

// ============================================================
// DEPARTMENTS
// ============================================================
export const DEPARTMENTS = [
  'Management',
  'Front Desk',
  'Housekeeping',
  'Food & Beverage',
  'Maintenance',
  'Security',
  'Finance',
  'Human Resources',
  'Sales & Marketing',
  'Spa & Wellness',
  'Recreation',
  'IT',
  'Procurement',
  'Vendor Management',
  'Guest Relations',
] as const;

export type Department = (typeof DEPARTMENTS)[number];

// ============================================================
// JWT CONFIG
// ============================================================
export const JWT_EXPIRES_IN = '24h';
export const JWT_COOKIE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours in ms

// ============================================================
// BCRYPT
// ============================================================
export const BCRYPT_SALT_ROUNDS = 12;
