import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { UserService } from '../auth/user/user.service';
import { ProjectService } from '../project/project/project.service';
import { OrganizationService } from './organization.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { UnitMember } from './entities/unit-member.entity';
import { Project } from '../project/entities/project.entity';
import { Category } from '../project/entities/category.entity';
import { CreateProjectInput, UpdateProjectInput, AddProjectMemberInput } from '../project/dto/project.dto';
import { CreateCategoryInput, UpdateCategoryInput } from '../project/dto/category.dto';

@Resolver(() => UnitMember)
export class UnitMemberResolver {
  constructor(
    private userService: UserService,
    private projectService: ProjectService,
    private organizationService: OrganizationService,
  ) {}

  @Query(() => [UnitMember], { name: 'myUnitMemberships' })
  @UseGuards(JwtAuthGuard)
  async myUnitMemberships(@CurrentUser() user: User): Promise<any[]> {
    return this.userService.findUserUnitMemberships(user.id);
  }

  @Query(() => [Project], { name: 'getUnitProjectsAsMember' })
  @UseGuards(JwtAuthGuard)
  async getUnitProjectsAsMember(
    @Args('unitId') unitId: number,
    @CurrentUser() user: User,
  ): Promise<Project[]> {
    // Verificar que el usuario es unit_member de esta unidad
    const canView = await this.userService.canViewAllProjectsInUnit(user.id, unitId);
    if (!canView) {
      throw new Error('No tienes permisos para ver los proyectos de esta unidad');
    }

    // Obtener todos los proyectos de la unidad
    const unit = await this.organizationService.findUnitById(unitId);
    if (!unit.project) {
      return [];
    }

    // Mapear los proyectos al formato correcto
    return unit.project.map(project => ({
      id: project.id,
      name: project.name || '',
      description: project.description || undefined,
      startDate: project.startdate || undefined,
      dueDate: project.duedate || undefined,
      editedAt: project.editedat || undefined,
      editorId: project.ideditor || undefined,
      categoryId: project.idcategory || undefined,
      unitId: project.idunit || undefined,
    }));
  }

  @Mutation(() => Project, { name: 'createProjectAsUnitMember' })
  @UseGuards(JwtAuthGuard)
  async createProjectAsUnitMember(
    @Args('createProjectInput') createProjectInput: CreateProjectInput,
    @CurrentUser() user: User,
  ): Promise<Project> {
    // Verificar que el usuario es unit_member de la unidad del proyecto
    if (!createProjectInput.unitId) {
      throw new Error('El proyecto debe estar asociado a una unidad');
    }

    const canCreate = await this.userService.canCreateProjectInUnit(user.id, createProjectInput.unitId);
    if (!canCreate) {
      throw new Error('No tienes permisos para crear proyectos en esta unidad');
    }

    return this.projectService.createProject(createProjectInput, user.id);
  }

  @Mutation(() => Project, { name: 'updateProjectAsUnitMember' })
  @UseGuards(JwtAuthGuard)
  async updateProjectAsUnitMember(
    @Args('projectId') projectId: string,
    @Args('updateProjectInput') updateProjectInput: UpdateProjectInput,
    @CurrentUser() user: User,
  ): Promise<Project> {
    // Obtener el proyecto para verificar la unidad
    const project = await this.projectService.findProjectById(projectId);
    if (!project) {
      throw new Error('Proyecto no encontrado');
    }

    // Verificar que el usuario es unit_member de la unidad del proyecto
    if (!project.unitId) {
      throw new Error('El proyecto no está asociado a ninguna unidad');
    }
    
    const canEdit = await this.userService.canEditProjectInUnit(user.id, project.unitId);
    if (!canEdit) {
      throw new Error('No tienes permisos para editar este proyecto');
    }

    return this.projectService.updateProject(updateProjectInput, user.id);
  }

  @Mutation(() => Boolean, { name: 'assignProjectMemberAsUnitMember' })
  @UseGuards(JwtAuthGuard)
  async assignProjectMemberAsUnitMember(
    @Args('projectId') projectId: string,
    @Args('addProjectMemberInput') addProjectMemberInput: AddProjectMemberInput,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    // Obtener el proyecto para verificar la unidad
    const project = await this.projectService.findProjectById(projectId);
    if (!project) {
      throw new Error('Proyecto no encontrado');
    }

    // Verificar que el usuario es unit_member de la unidad del proyecto
    if (!project.unitId) {
      throw new Error('El proyecto no está asociado a ninguna unidad');
    }
    
    const canAssign = await this.userService.canAssignProjectMembers(user.id, project.unitId);
    if (!canAssign) {
      throw new Error('No tienes permisos para asignar miembros a este proyecto');
    }

    // Crear el input con el projectId
    const addMemberInput = {
      ...addProjectMemberInput,
      projectId: projectId
    };
    await this.projectService.addProjectMember(addMemberInput, user.id);
    return true;
  }

  @Mutation(() => Boolean, { name: 'removeProjectMemberAsUnitMember' })
  @UseGuards(JwtAuthGuard)
  async removeProjectMemberAsUnitMember(
    @Args('projectId') projectId: string,
    @Args('userId') userId: string,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    // Obtener el proyecto para verificar la unidad
    const project = await this.projectService.findProjectById(projectId);
    if (!project) {
      throw new Error('Proyecto no encontrado');
    }

    // Verificar que el usuario es unit_member de la unidad del proyecto
    if (!project.unitId) {
      throw new Error('El proyecto no está asociado a ninguna unidad');
    }
    
    const canRemove = await this.userService.canRemoveProjectMembers(user.id, project.unitId);
    if (!canRemove) {
      throw new Error('No tienes permisos para remover miembros de este proyecto');
    }

    await this.projectService.removeProjectMember(projectId, userId, user.id);
    return true;
  }

}
