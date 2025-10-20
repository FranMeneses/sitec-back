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
    // Super admin - se materializa como super_admin membership
    if (this.hasRole(user, 'super_admin')) {
      return await this.checkSuperAdminPermissions(user, action, resource);
    }

    // Area role - se materializa como admin o area_member
    if (this.hasRole(user, 'area_role')) {
      return await this.checkAreaRoleMemberships(user, action, resource);
    }

    // Unit role - se materializa como unit_member
    if (this.hasRole(user, 'unit_role')) {
      return await this.checkUnitMemberPermissions(user, action, resource);
    }

    // User role - permisos basados en membresías específicas
    if (this.hasRole(user, 'user')) {
      return await this.checkUserMembershipPermissions(user, action, resource);
    }

    return false;
  }

  // Nuevos métodos para verificar permisos de usuarios con rol "user"
  private async checkUserMembershipPermissions(user: any, action: string, resource: string): Promise<boolean> {
    // Los usuarios "user" pueden tener diferentes capacidades según sus membresías

    // 1. Si es project_member, tiene permisos amplios en sus proyectos
    if (user.projectMemberships?.length > 0) {
      return await this.checkUserAsProjectMember(user, action, resource);
    }

    // 2. Si solo es task_member (sin project_member), permisos limitados
    if (user.taskMemberships?.length > 0) {
      return await this.checkUserAsTaskMember(user, action, resource);
    }

    // 3. Si no tiene membresías, solo lectura muy limitada
    return false;
  }

  private async checkUserAsProjectMember(user: any, action: string, resource: string): Promise<boolean> {
    // Usuario "user" como project_member puede:
    
    // Ver proyectos, procesos y tareas de sus proyectos
    if (action === 'read' && ['project', 'process', 'task', 'comment', 'evidence'].includes(resource)) {
      return true; // Validación específica de proyecto se hace en el servicio
    }

    // Crear, editar procesos y tareas en sus proyectos
    if (['create', 'update'].includes(action) && ['process', 'task'].includes(resource)) {
      return true;
    }

    // Comentar y cargar evidencias
    if (action === 'create' && ['comment', 'evidence'].includes(resource)) {
      return true;
    }

    // Actualizar tareas (como task_member heredado)
    if (action === 'update' && resource === 'task') {
      return true;
    }

    return false;
  }

  private async checkUserAsTaskMember(user: any, action: string, resource: string): Promise<boolean> {
    // Usuario "user" solo como task_member (permisos limitados)
    
    // Solo lectura de sus tareas asignadas
    if (action === 'read' && ['task', 'comment', 'evidence'].includes(resource)) {
      return true;
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
    // unit_member - Ver proyectos asociados a su unidad
    if (action === 'read' && ['project', 'process', 'task', 'evidence', 'comment'].includes(resource)) {
      return true; // La validación específica (solo su unidad) se hace en el servicio
    }

    // unit_member - Subir evidencias a tareas
    if (action === 'create' && resource === 'evidence') {
      return true; // La validación específica se hará en el servicio
    }

    // unit_member - Actualizar avance de tareas
    if (action === 'update' && resource === 'task') {
      return true; // La validación específica se hará en el servicio
    }

    // unit_member - Asignar tareas a usuarios de su unidad
    if (action === 'create' && resource === 'task_member') {
      return true; // La validación específica se hará en el servicio
    }

    if (action === 'delete' && resource === 'task_member') {
      return true; // La validación específica se hará en el servicio
    }

    // unit_member - Heredar capacidades de project_member
    return await this.checkUserAsProjectMember(user, action, resource);
  }

  private async checkAreaMemberPermissions(user: any, action: string, resource: string): Promise<boolean> {
    // area_member - Ver categorías y proyectos asociados a su área
    if (action === 'read' && ['category', 'project', 'process', 'task', 'evidence', 'comment'].includes(resource)) {
      return true; // La validación específica de área se hará en el servicio
    }

    // area_member - Crear, editar o borrar categorías y proyectos
    if (['create', 'update', 'delete'].includes(action) && ['category', 'project'].includes(resource)) {
      return true; // La validación específica de área se hará en el servicio
    }

    // area_member - Asignar usuarios a un proyecto
    if (['create', 'delete'].includes(action) && resource === 'project_member') {
      return true; // La validación específica se hará en el servicio
    }

    // area_member - Revisar y aprobar evidencias
    if (['read', 'update'].includes(action) && resource === 'evidence') {
      return true; // La validación específica se hará en el servicio
    }

    // area_member - Ver y analizar KPIs de su área
    if (action === 'read' && resource === 'kpi') {
      return true; // La validación específica se hará en el servicio
    }

    // area_member - Ver los dashboards de su área
    if (action === 'read' && resource === 'dashboard') {
      return true; // La validación específica se hará en el servicio
    }

    // area_member - Comentar y retroalimentar en proyectos y tareas
    if (action === 'create' && resource === 'comment') {
      return true; // La validación específica se hará en el servicio
    }

    // area_member - Ver el historial de proyectos y su información
    if (action === 'read' && resource === 'project_history') {
      return true; // La validación específica se hará en el servicio
    }

    // area_member - Consultar logs del sistema
    if (['read', 'export'].includes(action) && resource === 'system_logs') {
      return true; // Acceso a logs del sistema
    }

    // area_member - Heredar todas las capacidades de project_member
    return await this.checkUserAsProjectMember(user, action, resource);
  }

  private async checkAreaRoleMemberships(user: any, action: string, resource: string): Promise<boolean> {
    // Verificar si es admin (permisos superiores)
    if (user.admin) {
      return await this.checkAdminPermissions(user, action, resource);
    }

    // Verificar si es area_member
    if (user.areaMemberships && user.areaMemberships.length > 0) {
      return await this.checkAreaMemberPermissions(user, action, resource);
    }

    return false;
  }

  private async checkAdminPermissions(user: any, action: string, resource: string): Promise<boolean> {
    // admin - Ver todo dentro de sus áreas
    if (action === 'read' && ['category', 'project', 'process', 'task', 'evidence', 'comment'].includes(resource)) {
      return true; // La validación específica de área se hará en el servicio
    }

    // admin - Crear, editar o borrar categorías y proyectos
    if (['create', 'update', 'delete'].includes(action) && ['category', 'project'].includes(resource)) {
      return true; // La validación específica de área se hará en el servicio
    }

    // admin - Asignar usuarios como area_members (SOLO area_members, NO admins)
    if (['create', 'delete'].includes(action) && resource === 'area_member') {
      return true; // La validación específica se hará en el servicio
    }

    // NOTA: admin NO puede asignar otros admins - eso es exclusivo de super_admin

    // admin - Ver y analizar KPIs de su área
    if (action === 'read' && resource === 'kpi') {
      return true; // La validación específica se hará en el servicio
    }

    // admin - Restaurar proyectos archivados o finalizados
    if (action === 'reactivate' && ['project', 'task'].includes(resource)) {
      return true; // La validación específica se hará en el servicio
    }

    // admin - Consultar logs del sistema
    if (['read', 'export'].includes(action) && resource === 'system_logs') {
      return true; // Acceso a logs del sistema
    }

    // admin - Heredar todas las capacidades de area_member
    return await this.checkAreaMemberPermissions(user, action, resource);
  }

  private async checkSuperAdminPermissions(user: any, action: string, resource: string): Promise<boolean> {
    // super_admin - Ver todas áreas y unidades (sin restricción de área)
    if (action === 'read' && ['area', 'unit', 'category', 'project', 'process', 'task', 'evidence', 'comment'].includes(resource)) {
      return true; // Acceso global sin restricciones
    }

    // super_admin - Crear, editar y eliminar áreas y unidades
    if (['create', 'update', 'delete'].includes(action) && ['area', 'unit'].includes(resource)) {
      return true; // Gestión completa de áreas y unidades
    }

    // super_admin - Asignar admins y unit_members (roles de alto nivel)
    if (['create', 'update', 'delete'].includes(action) && ['admin', 'unit_member', 'area_member', 'user_role'].includes(resource)) {
      return true; // Gestión completa de roles de usuarios - solo super_admin puede asignar admins y unit_members
    }

    // super_admin - Gestionar las configuraciones globales
    if (['read', 'create', 'update', 'delete'].includes(action) && resource === 'system_config') {
      return true; // Configuraciones del sistema
    }

    // super_admin - Ver todos los proyectos y su información (global)
    if (action === 'read' && resource === 'all_projects') {
      return true; // Vista global de proyectos
    }

    // super_admin - Consultar y exportar logs del sistema
    if (['read', 'export'].includes(action) && resource === 'system_logs') {
      return true; // Gestión de logs del sistema
    }

    // super_admin - Ver el historial de cualquier proyecto (global)
    if (action === 'read' && resource === 'global_project_history') {
      return true; // Historial global
    }

    // super_admin - Agregar nuevos usuarios al sistema
    if (action === 'create' && resource === 'user') {
      return true; // Creación de usuarios
    }

    // super_admin - Heredar todas las capacidades de admin
    return await this.checkAdminPermissions(user, action, resource);
  }

  private hasRole(user: any, roleName: string): boolean {
    if (user.roles && Array.isArray(user.roles)) {
      return user.roles.some(userRole => userRole.name === roleName);
    }
    return false;
  }
}
