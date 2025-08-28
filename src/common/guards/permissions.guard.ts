import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<{ action: string; resource: string }>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si no hay permisos requeridos, permitir acceso
    if (!requiredPermission) {
      return true;
    }

    // Obtener el contexto de GraphQL
    const gqlContext = GqlExecutionContext.create(context);
    const { user } = gqlContext.getContext();

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    const { action, resource } = requiredPermission;

    // Verificar permisos básicos del usuario
    const hasPermission = this.checkBasicPermission(user, action, resource);

    if (!hasPermission) {
      throw new ForbiddenException(
        `Acceso denegado. Se requiere permiso: ${action} en ${resource}`
      );
    }

    return true;
  }

  private checkBasicPermission(user: any, action: string, resource: string): boolean {
    // Super admin tiene todos los permisos
    if (this.hasRole(user, 'super_admin')) {
      return true;
    }

    // Admin tiene permisos de organización
    if (this.hasRole(user, 'admin') && ['area', 'unit'].includes(resource)) {
      return true;
    }

    // Usuario básico solo puede leer
    if (this.hasRole(user, 'user') && action === 'read') {
      return true;
    }

    return false;
  }

  private hasRole(user: any, roleName: string): boolean {
    if (user.roles && Array.isArray(user.roles)) {
      return user.roles.some(userRole => userRole.name === roleName);
    }
    return false;
  }
}
