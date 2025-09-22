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
    const { user } = gqlContext.getContext().req;

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

    // Admin tiene permisos de organización y hereda permisos de roles inferiores
    if (this.hasRole(user, 'admin')) {
      // Permisos específicos de admin
      if (['area', 'unit', 'category'].includes(resource)) {
        return true;
      }
      
      // Herencia de permisos de roles inferiores
      if (['project', 'process', 'task'].includes(resource)) {
        return true; // El admin puede realizar acciones en estos recursos dentro de su área
      }
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

    // Project member tiene permisos amplios en sus proyectos asignados
    if (this.hasRole(user, 'project_member')) {
      return await this.checkProjectMemberPermissions(user, action, resource);
    }

    // Unit member tiene permisos amplios en sus unidades asignadas
    if (this.hasRole(user, 'unit_member')) {
      return await this.checkUnitMemberPermissions(user, action, resource);
    }

    // Area member (auditor) tiene permisos de auditoría en su área asignada
    if (this.hasRole(user, 'area_member')) {
      return await this.checkAreaMemberPermissions(user, action, resource);
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

  private async checkProjectMemberPermissions(user: any, action: string, resource: string): Promise<boolean> {
    // Project member puede leer proyectos, procesos y tareas
    if (action === 'read' && ['project', 'process', 'task'].includes(resource)) {
      return true;
    }

    // Project member puede crear procesos en sus proyectos
    if (action === 'create' && resource === 'process') {
      return true; // La validación específica se hará en el servicio
    }

    // Project member puede actualizar procesos en sus proyectos
    if (action === 'update' && resource === 'process') {
      return true; // La validación específica se hará en el servicio
    }

    // Project member puede crear tareas (heredado de process_member)
    if (action === 'create' && resource === 'task') {
      return true; // La validación específica se hará en el servicio
    }

    // Project member puede actualizar tareas (heredado de process_member)
    if (action === 'update' && resource === 'task') {
      return true; // La validación específica se hará en el servicio
    }

    // Project member puede crear comentarios y evidencias (heredado)
    if (action === 'create' && ['comment', 'evidence'].includes(resource)) {
      return true; // La validación específica se hará en el servicio
    }

    // Project member puede asignar y remover process_members
    if (action === 'create' && resource === 'process_member') {
      return true; // La validación específica se hará en el servicio
    }

    if (action === 'delete' && resource === 'process_member') {
      return true; // La validación específica se hará en el servicio
    }

    // Project member puede asignar y remover task_members (heredado)
    if (action === 'create' && resource === 'task_member') {
      return true; // La validación específica se hará en el servicio
    }

    if (action === 'delete' && resource === 'task_member') {
      return true; // La validación específica se hará en el servicio
    }

    return false;
  }

  private async checkUnitMemberPermissions(user: any, action: string, resource: string): Promise<boolean> {
    // Unit member puede leer proyectos, procesos, tareas y categorías
    if (action === 'read' && ['project', 'process', 'task', 'category'].includes(resource)) {
      return true;
    }

    // Unit member puede crear proyectos en sus unidades
    if (action === 'create' && resource === 'project') {
      return true; // La validación específica se hará en el servicio
    }

    // Unit member puede actualizar proyectos en sus unidades
    if (action === 'update' && resource === 'project') {
      return true; // La validación específica se hará en el servicio
    }

    // Unit member puede crear categorías
    if (action === 'create' && resource === 'category') {
      return true; // La validación específica se hará en el servicio
    }

    // Unit member puede actualizar categorías
    if (action === 'update' && resource === 'category') {
      return true; // La validación específica se hará en el servicio
    }

    // Unit member puede crear procesos (heredado de project_member)
    if (action === 'create' && resource === 'process') {
      return true; // La validación específica se hará en el servicio
    }

    // Unit member puede actualizar procesos (heredado de project_member)
    if (action === 'update' && resource === 'process') {
      return true; // La validación específica se hará en el servicio
    }

    // Unit member puede crear tareas (heredado de process_member)
    if (action === 'create' && resource === 'task') {
      return true; // La validación específica se hará en el servicio
    }

    // Unit member puede actualizar tareas (heredado de process_member)
    if (action === 'update' && resource === 'task') {
      return true; // La validación específica se hará en el servicio
    }

    // Unit member puede crear comentarios y evidencias (heredado)
    if (action === 'create' && ['comment', 'evidence'].includes(resource)) {
      return true; // La validación específica se hará en el servicio
    }

    // Unit member puede asignar y remover project_members
    if (action === 'create' && resource === 'project_member') {
      return true; // La validación específica se hará en el servicio
    }

    if (action === 'delete' && resource === 'project_member') {
      return true; // La validación específica se hará en el servicio
    }

    // Unit member puede asignar y remover process_members (heredado)
    if (action === 'create' && resource === 'process_member') {
      return true; // La validación específica se hará en el servicio
    }

    if (action === 'delete' && resource === 'process_member') {
      return true; // La validación específica se hará en el servicio
    }

    // Unit member puede asignar y remover task_members (heredado)
    if (action === 'create' && resource === 'task_member') {
      return true; // La validación específica se hará en el servicio
    }

    if (action === 'delete' && resource === 'task_member') {
      return true; // La validación específica se hará en el servicio
    }

    return false;
  }

  private async checkAreaMemberPermissions(user: any, action: string, resource: string): Promise<boolean> {
    // Area member puede leer todos los proyectos, procesos y tareas de su área
    if (action === 'read' && ['project', 'process', 'task', 'evidence', 'comment', 'category'].includes(resource)) {
      return true; // La validación específica de área se hará en el servicio
    }

    // Area member puede gestionar categorías de su área
    if (['create', 'update', 'delete'].includes(action) && resource === 'category') {
      return true; // La validación específica de área se hará en el servicio
    }

    // Area member puede reactivar tareas (cambiar estado de cancelled/completed a pending/in_progress)
    if (action === 'reactivate' && resource === 'task') {
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
