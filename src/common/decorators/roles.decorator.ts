import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

// Solo roles críticos del sistema
export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  USER: 'user',
} as const;

// Decorador simple para roles
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// Decorador para admin (admin o super_admin)
export const RequireAdmin = () => SetMetadata(ROLES_KEY, [SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN]);

// Decorador para super admin
export const RequireSuperAdmin = () => SetMetadata(ROLES_KEY, [SYSTEM_ROLES.SUPER_ADMIN]);

// Decorador para usuarios autenticados
export const RequireAuth = () => SetMetadata(ROLES_KEY, [SYSTEM_ROLES.USER, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN]);
