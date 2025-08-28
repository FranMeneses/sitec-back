import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

// Decorador para requerir permiso específico
export const RequirePermission = (action: string, resource: string) => 
  SetMetadata(PERMISSIONS_KEY, { action, resource });

// Permisos básicos del sistema
export const PERMISSIONS = {
  // Acciones básicas
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  
  // Recursos del sistema
  AREA: 'area',
  UNIT: 'unit',
  PROJECT: 'project',
  PROCESS: 'process',
  TASK: 'task',
  EVIDENCE: 'evidence',
  COMMENT: 'comment',
} as const;

// Combinaciones comunes
export const PERMISSION_COMBOS = {
  // Solo lectura
  READ_ONLY: [PERMISSIONS.READ],
  
  // Gestión básica
  BASIC_MANAGEMENT: [PERMISSIONS.CREATE, PERMISSIONS.READ, PERMISSIONS.UPDATE],
  
  // Gestión completa
  FULL_MANAGEMENT: [PERMISSIONS.CREATE, PERMISSIONS.READ, PERMISSIONS.UPDATE, PERMISSIONS.DELETE],
} as const;
