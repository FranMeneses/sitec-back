import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserService } from '../../auth/user/user.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
    const hasPermission = await this.checkBasicPermission(user, action, resource);

    if (!hasPermission) {
      throw new ForbiddenException(
        `Acceso denegado. Se requiere permiso: ${action} en ${resource}`
      );
    }

    return true;
  }

  private async checkBasicPermission(user: any, action: string, resource: string): Promise<boolean> {
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

    // Task member tiene permisos limitados en sus tareas asignadas
    if (this.hasRole(user, 'task_member')) {
      return await this.checkTaskMemberPermissions(user, action, resource);
    }

    // Process member tiene permisos amplios en sus procesos asignados
    if (this.hasRole(user, 'process_member')) {
      return await this.checkProcessMemberPermissions(user, action, resource);
    }

    return false;
  }

  private async checkTaskMemberPermissions(user: any, action: string, resource: string): Promise<boolean> {
    // Task member puede leer sus tareas asignadas
    if (action === 'read' && resource === 'task') {
      return true;
    }

    // Task member puede actualizar reporte y estado de sus tareas
    if (action === 'update' && resource === 'task') {
      return true; // La validación específica se hará en el servicio
    }

    // Task member puede crear comentarios y evidencias en sus tareas
    if (action === 'create' && ['comment', 'evidence'].includes(resource)) {
      return true; // La validación específica se hará en el servicio
    }

    return false;
  }

  private async checkProcessMemberPermissions(user: any, action: string, resource: string): Promise<boolean> {
    // Process member puede leer procesos y tareas
    if (action === 'read' && ['process', 'task'].includes(resource)) {
      return true;
    }

    // Process member puede crear tareas en sus procesos
    if (action === 'create' && resource === 'task') {
      return true; // La validación específica se hará en el servicio
    }

    // Process member puede actualizar tareas en sus procesos
    if (action === 'update' && resource === 'task') {
      return true; // La validación específica se hará en el servicio
    }

    // Process member puede crear comentarios y evidencias
    if (action === 'create' && ['comment', 'evidence'].includes(resource)) {
      return true; // La validación específica se hará en el servicio
    }

    // Process member puede asignar y remover task_members
    if (action === 'create' && resource === 'task_member') {
      return true; // La validación específica se hará en el servicio
    }

    if (action === 'delete' && resource === 'task_member') {
      return true; // La validación específica se hará en el servicio
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
