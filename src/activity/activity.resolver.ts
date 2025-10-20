import { Resolver, Query, Mutation, Args, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards, ForbiddenException } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { Evidence } from './entities/evidence.entity';
import { Comment } from './entities/comment.entity';
import { Logs } from './entities/logs.entity';
import { CreateEvidenceInput, UpdateEvidenceInput } from './dto/evidence.dto';
import { CreateCommentInput, UpdateCommentInput } from './dto/comment.dto';
import { CreateLogInput } from './dto/logs.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { UserService } from '../auth/user/user.service';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { ProcessService } from '../process/process.service';

@Resolver(() => Evidence)
export class EvidenceResolver {
  constructor(
    private activityService: ActivityService,
    private userService: UserService,
    private processService: ProcessService,
  ) { }

  // ==================== EVIDENCE QUERIES ====================

  @Query(() => [Evidence])
  @UseGuards(JwtAuthGuard)
  async evidence(
    @CurrentUser() user: User,
    @Args('includeArchived', { defaultValue: false }) includeArchived: boolean,
  ): Promise<Evidence[]> {
    return this.activityService.findAllEvidence(user.id, includeArchived);
  }

  @Query(() => Evidence, { nullable: true })
  @UseGuards(JwtAuthGuard)
  async evidenceById(
    @Args('id') id: string,
    @Args('includeArchived', { defaultValue: false }) includeArchived: boolean,
  ): Promise<Evidence | null> {
    return this.activityService.findEvidenceById(id, includeArchived);
  }

  @Query(() => [Evidence])
  @UseGuards(JwtAuthGuard)
  async evidenceByTask(
    @Args('taskId') taskId: string,
    @Args('includeArchived', { defaultValue: false }) includeArchived: boolean,
  ): Promise<Evidence[]> {
    return this.activityService.findEvidenceByTask(taskId, includeArchived);
  }

  @Query(() => [Evidence])
  @UseGuards(JwtAuthGuard)
  async archivedEvidenceByTask(@Args('taskId') taskId: string): Promise<Evidence[]> {
    return this.activityService.findEvidenceByTask(taskId, true);
  }

  // ==================== EVIDENCE MUTATIONS ====================

  @Mutation(() => Evidence)
  @UseGuards(JwtAuthGuard)
  async createEvidence(
    @Args('createEvidenceInput') createEvidenceInput: CreateEvidenceInput,
    @CurrentUser() user: User,
  ): Promise<Evidence> {
    return this.activityService.createEvidence(createEvidenceInput, user.id);
  }

  @Mutation(() => Evidence)
  @UseGuards(JwtAuthGuard)
  async updateEvidence(
    @Args('updateEvidenceInput') updateEvidenceInput: UpdateEvidenceInput,
    @CurrentUser() user: User,
  ): Promise<Evidence> {
    return this.activityService.updateEvidence(updateEvidenceInput, user.id);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteEvidence(
    @Args('id') id: string,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    return this.activityService.deleteEvidence(id, user.id);
  }

  @Mutation(() => Evidence)
  @UseGuards(JwtAuthGuard)
  async archiveEvidence(
    @Args('id') id: string,
    @CurrentUser() user: User,
  ): Promise<Evidence> {
    return this.activityService.archiveEvidence(id, user.id);
  }

  @Mutation(() => Evidence)
  @UseGuards(JwtAuthGuard)
  async unarchiveEvidence(
    @Args('id') id: string,
    @CurrentUser() user: User,
  ): Promise<Evidence> {
    return this.activityService.unarchiveEvidence(id, user.id);
  }

  @Mutation(() => Evidence)
  @UseGuards(JwtAuthGuard)
  async replaceEvidence(
    @Args('evidenceId') evidenceId: string,
    @Args('newLink') newLink: string,
    @Args('review', { nullable: true }) review: string,
    @CurrentUser() user: User,
  ): Promise<Evidence> {
    return this.activityService.replaceEvidence(evidenceId, newLink, user.id, review);
  }

  @Mutation(() => Evidence)
  @UseGuards(JwtAuthGuard)
  async approveEvidence(
    @Args('evidenceId') evidenceId: string,
    @CurrentUser() user: User,
  ): Promise<Evidence> {
    return this.activityService.approveEvidence(evidenceId, user.id);
  }

  @Mutation(() => Evidence)
  @UseGuards(JwtAuthGuard)
  async rejectEvidence(
    @Args('evidenceId') evidenceId: string,
    @CurrentUser() user: User,
  ): Promise<Evidence> {
    return this.activityService.rejectEvidence(evidenceId, user.id);
  }

  @Query(() => [Evidence])
  @UseGuards(JwtAuthGuard)
  async getEvidenceByProject(
    @Args('projectId') projectId: string,
    @Args('includeArchived', { defaultValue: false }) includeArchived: boolean,
    @CurrentUser() user: User,
  ): Promise<Evidence[]> {
    // Verificar si el usuario es superadmin
    const isSuperAdmin = await this.userService.isSuperAdmin(user.id);
    // Si es superadmin, puede ver todas las evidencias sin restricción
    if (isSuperAdmin) {
      return this.activityService.findEvidenceByProject(projectId, includeArchived);
    }
    // Verificar si el usuario tiene permiso a ver la evidencia
    const canViewTasks = await this.userService.canViewAllTasksInProject(user.id, projectId);
    if (!canViewTasks) {
      throw new ForbiddenException(
        'No tienes permisos para ver las evidencias de este proyecto',
      );
    }

    // Retornar las evidencias si cumple las condiciones
    return this.activityService.findEvidenceByProject(projectId, includeArchived);
  }

  @Query(() => [Evidence])
  @UseGuards(JwtAuthGuard)
  async evidenceByUser(
    @Args('userId') userId: string,
    @Args('includeArchived', { defaultValue: false }) includeArchived: boolean,
    @CurrentUser() user: User,
  ): Promise<Evidence[]> {
    // Verificar permisos según la jerarquía de roles
    const isSuperAdmin = await this.userService.isSuperAdmin(user.id);
    const isOwnProfile = user.id === userId;
    
    // Solo super_admin puede consultar evidencias de otros usuarios
    // Los demás usuarios solo pueden consultar sus propias evidencias
    if (!isSuperAdmin && !isOwnProfile) {
      throw new ForbiddenException(
        'Solo los super administradores pueden consultar evidencias de otros usuarios',
      );
    }

    return this.activityService.findEvidenceByUser(userId, includeArchived);
  }

  @Query(() => [Evidence])
  @UseGuards(JwtAuthGuard)
  async evidenceByProcess(
    @Args('processId') processId: string,
    @Args('includeArchived', { defaultValue: false }) includeArchived: boolean,
    @CurrentUser() user: User,
  ): Promise<Evidence[]> {
    // Verificar si el usuario tiene acceso al proceso
    // Primero obtenemos el proceso para verificar el proyecto asociado
    const process = await this.processService.findProcessById(processId);
    if (!process) {
      throw new ForbiddenException('El proceso especificado no existe');
    }

    // Verificar acceso al proyecto del proceso
    const canAccessProject = await this.userService.canAccessProject(user.id, process.projectId);
    if (!canAccessProject) {
      throw new ForbiddenException(
        'No tienes permisos para ver las evidencias de este proceso',
      );
    }

    return this.activityService.findEvidenceByProcess(processId, includeArchived);
  }

  @Query(() => [Evidence])
  @UseGuards(JwtAuthGuard)
  async pendingEvidence(
    @Args('includeArchived', { defaultValue: false }) includeArchived: boolean,
    @CurrentUser() user: User,
  ): Promise<Evidence[]> {
    // Verificar que el usuario es area_role (puede ver evidencias pendientes)
    const isSuperAdmin = await this.userService.isSuperAdmin(user.id);
    const isAreaRole = await this.userService.isAreaRole(user.id);
    
    if (!isSuperAdmin && !isAreaRole) {
      throw new ForbiddenException(
        'Solo los area_role pueden ver evidencias pendientes',
      );
    }

    return this.activityService.findPendingEvidence(user.id, includeArchived);
  }

  @Query(() => [Evidence])
  @UseGuards(JwtAuthGuard)
  async approvedEvidence(
    @Args('includeArchived', { defaultValue: false }) includeArchived: boolean,
    @CurrentUser() user: User,
  ): Promise<Evidence[]> {
    return this.activityService.findApprovedEvidence(user.id, includeArchived);
  }

  @Query(() => [Evidence])
  @UseGuards(JwtAuthGuard)
  async rejectedEvidence(
    @Args('includeArchived', { defaultValue: false }) includeArchived: boolean,
    @CurrentUser() user: User,
  ): Promise<Evidence[]> {
    return this.activityService.findRejectedEvidence(user.id, includeArchived);
  }
}

@Resolver(() => Comment)
export class CommentResolver {
  constructor(private activityService: ActivityService) { }

  // ==================== COMMENT QUERIES ====================

  @Query(() => [Comment])
  @UseGuards(JwtAuthGuard)
  async comments(@CurrentUser() user: User): Promise<Comment[]> {
    return this.activityService.findAllComments(user.id);
  }

  @Query(() => Comment, { nullable: true })
  @UseGuards(JwtAuthGuard)
  async commentById(@Args('id') id: string): Promise<Comment | null> {
    return this.activityService.findCommentById(id);
  }

  @Query(() => [Comment])
  @UseGuards(JwtAuthGuard)
  async commentsByTask(@Args('taskId') taskId: string): Promise<Comment[]> {
    return this.activityService.findCommentsByTask(taskId);
  }

  // ==================== COMMENT MUTATIONS ====================

  @Mutation(() => Comment)
  @UseGuards(JwtAuthGuard)
  async createComment(
    @Args('createCommentInput') createCommentInput: CreateCommentInput,
    @CurrentUser() user: User,
  ): Promise<Comment> {
    return this.activityService.createComment(createCommentInput, user.id);
  }

  @Mutation(() => Comment)
  @UseGuards(JwtAuthGuard)
  async updateComment(
    @Args('updateCommentInput') updateCommentInput: UpdateCommentInput,
    @CurrentUser() user: User,
  ): Promise<Comment> {
    return this.activityService.updateComment(updateCommentInput, user.id);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteComment(
    @Args('id') id: string,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    return this.activityService.deleteComment(id, user.id);
  }
}

@Resolver(() => Logs)
export class LogsResolver {
  constructor(
    private activityService: ActivityService,
    private userService: UserService,
  ) { }

  // ==================== HELPER METHODS ====================

  private async verifyAdminAccess(userId: string): Promise<void> {
    const isSuperAdmin = await this.userService.isSuperAdmin(userId);
    const isAdmin = await this.userService.isAdmin(userId);
    const isAreaMember = await this.userService.isAreaMemberOfAny(userId);

    if (!isSuperAdmin && !isAdmin && !isAreaMember) {
      throw new ForbiddenException('Solo los super_admins, admins y miembros de área pueden acceder a los logs del sistema');
    }
  }

  // ==================== LOGS QUERIES ====================

  @Query(() => [Logs])
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('read', 'system_logs')
  async logs(@CurrentUser() user: User): Promise<Logs[]> {
    await this.verifyAdminAccess(user.id);
    return this.activityService.findAllLogs(user.id);
  }

  @Query(() => [Logs])
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('read', 'system_logs')
  async logsByProject(@Args('projectId') projectId: string, @CurrentUser() user: User): Promise<Logs[]> {
    await this.verifyAdminAccess(user.id);
    return this.activityService.findLogsByProject(projectId);
  }

  @Query(() => [Logs])
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('read', 'system_logs')
  async logsByProcess(@Args('processId') processId: string, @CurrentUser() user: User): Promise<Logs[]> {
    await this.verifyAdminAccess(user.id);
    return this.activityService.findLogsByProcess(processId);
  }

  @Query(() => [Logs])
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('read', 'system_logs')
  async logsByTask(@Args('taskId') taskId: string, @CurrentUser() user: User): Promise<Logs[]> {
    await this.verifyAdminAccess(user.id);
    return this.activityService.findLogsByTask(taskId);
  }

  @Query(() => [Logs])
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('read', 'system_logs')
  async findLogsByProjectId(@Args('idProject') idProject: string, @CurrentUser() user: User): Promise<Logs[]> {
    await this.verifyAdminAccess(user.id);
    return this.activityService.findLogsByProject(idProject);
  }

  @Query(() => [Logs])
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('read', 'system_logs')
  async findLogsByTaskId(@Args('idTask') idTask: string, @CurrentUser() user: User): Promise<Logs[]> {
    await this.verifyAdminAccess(user.id);
    return this.activityService.findLogsByTask(idTask);
  }

  @Query(() => [Logs])
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('read', 'system_logs')
  async findLogsByProcessId(@Args('idProcess') idProcess: string, @CurrentUser() user: User): Promise<Logs[]> {
    await this.verifyAdminAccess(user.id);
    return this.activityService.findLogsByProcess(idProcess);
  }

  // ==================== LOGS MUTATIONS ====================

  @Mutation(() => Logs)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('create', 'system_logs')
  async createLog(
    @Args('createLogInput') createLogInput: CreateLogInput,
    @CurrentUser() user: User,
  ): Promise<Logs> {
    await this.verifyAdminAccess(user.id);
    return this.activityService.createLog(createLogInput, user.id);
  }
}
