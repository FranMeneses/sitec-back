import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

// Roles del sistema según el nuevo esquema
export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'super_admin',
  AREA_ROLE: 'area_role',
  UNIT_ROLE: 'unit_role',
  USER: 'user',
} as const;

// Decorador simple para roles
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// Decorador para super admin
export const RequireSuperAdmin = () => SetMetadata(ROLES_KEY, [SYSTEM_ROLES.SUPER_ADMIN]);

// Decorador para area_role o superior
export const RequireAreaRole = () => SetMetadata(ROLES_KEY, [SYSTEM_ROLES.AREA_ROLE, SYSTEM_ROLES.SUPER_ADMIN]);

// Decorador para unit_role o superior
export const RequireUnitRole = () => SetMetadata(ROLES_KEY, [SYSTEM_ROLES.UNIT_ROLE, SYSTEM_ROLES.AREA_ROLE, SYSTEM_ROLES.SUPER_ADMIN]);

// Decorador para usuarios autenticados (cualquier rol del sistema)
export const RequireAuth = () => SetMetadata(ROLES_KEY, [SYSTEM_ROLES.USER, SYSTEM_ROLES.UNIT_ROLE, SYSTEM_ROLES.AREA_ROLE, SYSTEM_ROLES.SUPER_ADMIN]);

// Decorador específico para rol user (solo lectura)
export const RequireUser = () => SetMetadata(ROLES_KEY, [SYSTEM_ROLES.USER]);

// Decoradores de compatibilidad (ahora "admin" es rol interno, no de sistema)
// Estos decoradores ahora verifican area_role+ ya que admin es rol interno
export const RequireAdmin = () => SetMetadata(ROLES_KEY, [SYSTEM_ROLES.AREA_ROLE, SYSTEM_ROLES.SUPER_ADMIN]);
export const RequireAreaMember = () => SetMetadata(ROLES_KEY, [SYSTEM_ROLES.AREA_ROLE, SYSTEM_ROLES.SUPER_ADMIN]);

// Decorador específico para verificar membresía de admin (requiere verificación adicional en el guard)
export const RequireAdminMembership = () => SetMetadata('REQUIRE_ADMIN_MEMBERSHIP', true);

// Decorador para crear unidades: super_admin O admin/area_member con membresía
export const RequireUnitCreation = () => SetMetadata('REQUIRE_UNIT_CREATION', true);