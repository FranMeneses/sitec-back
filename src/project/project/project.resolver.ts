import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards, ForbiddenException } from '@nestjs/common';
import { ProjectService } from './project.service';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { Category } from '../entities/category.entity';
import { CreateProjectInput, UpdateProjectInput, AddProjectMemberInput, UpdateProjectMemberInput } from '../dto/project.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../auth/entities/user.entity';
import { Process } from '../../process/entities/process.entity';
import { Task } from '../../process/entities/task.entity';

@Resolver(() => Project)
export class ProjectResolver {
  constructor(private projectService: ProjectService) {}

  @Query(() => [Project])
  @UseGuards(JwtAuthGuard)
  async projects(@CurrentUser() user: User): Promise<Project[]> {
    return this.projectService.findAllProjects(user.id);
  }

  @Query(() => Project, { nullable: true })
  @UseGuards(JwtAuthGuard)
  async project(@Args('id') id: string): Promise<Project | null> {
    return this.projectService.findProjectById(id);
  }

  @Query(() => [ProjectMember])
  @UseGuards(JwtAuthGuard)
  async projectMembers(@Args('projectId') projectId: string): Promise<ProjectMember[]> {
    return this.projectService.getProjectMembers(projectId);
  }

  @Query(() => ProjectMember)
  @UseGuards(JwtAuthGuard)
  async projectMember(@Args('id') id: string): Promise<ProjectMember> {
    return this.projectService.getProjectMemberById(id);
  }

  @Query(() => [Project])
  @UseGuards(JwtAuthGuard)
  async findUnitProjects(@Args('idUnit') idUnit: number): Promise<Project[]> {
    return this.projectService.findUnitProjects(idUnit);
  }

  @Query(() => [Project])
  @UseGuards(JwtAuthGuard)
  async findAreaProjects(@Args('idArea') idArea: number): Promise<Project[]> {
    return this.projectService.findAreaProjects(idArea);
  }

  @Query(() => [Process])
  @UseGuards(JwtAuthGuard)
  async projectProcessesByProjectId(@Args('idProject') idProject: string): Promise<Process[]> {
    return this.projectService.getProjectProcesses(idProject);
  }

  @Query(() => [Process])
  @UseGuards(JwtAuthGuard)
  async projectProcessesByProcessId(@Args('idProcess') idProcess: string): Promise<Process[]> {
    return this.projectService.getProjectProcessesByProcessId(idProcess);
  }

  @Query(() => [Task])
  @UseGuards(JwtAuthGuard)
  async tasksByProjectId(@Args('idProject') idProject: string): Promise<Task[]> {
    return this.projectService.getProjectTasks(idProject);
  }

  @Mutation(() => Project)
  @UseGuards(JwtAuthGuard)
  async createProject(
    @Args('createProjectInput') createProjectInput: CreateProjectInput,
    @CurrentUser() user: User,
  ): Promise<Project> {
    return this.projectService.createProject(createProjectInput, user.id);
  }

  @Mutation(() => Project)
  @UseGuards(JwtAuthGuard)
  async updateProject(
    @Args('updateProjectInput') updateProjectInput: UpdateProjectInput,
    @CurrentUser() user: User,
  ): Promise<Project> {
    return this.projectService.updateProject(updateProjectInput, user.id);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteProject(
    @Args('id') id: string,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    return this.projectService.deleteProject(id, user.id);
  }

  @Mutation(() => ProjectMember)
  @UseGuards(JwtAuthGuard)
  async addProjectMember(
    @Args('addProjectMemberInput') addProjectMemberInput: AddProjectMemberInput,
    @CurrentUser() user: User,
  ): Promise<ProjectMember> {
    return this.projectService.addProjectMember(addProjectMemberInput, user.id);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async removeProjectMember(
    @Args('projectId') projectId: string,
    @Args('userId') userId: string,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    return this.projectService.removeProjectMember(projectId, userId, user.id);
  }

  @Mutation(() => ProjectMember)
  @UseGuards(JwtAuthGuard)
  async updateProjectMember(
    @Args('updateProjectMemberInput') updateProjectMemberInput: UpdateProjectMemberInput,
    @CurrentUser() user: User,
  ): Promise<ProjectMember> {
    return this.projectService.updateProjectMember(updateProjectMemberInput, user.id);
  }

  @Mutation(() => String)
  @UseGuards(JwtAuthGuard)
  async createProjectProcess(
    @Args('idProject') idProject: string,
    @Args('idProcess') idProcess: string,
    @CurrentUser() user: User,
  ): Promise<string> {
    return this.projectService.createProjectProcess(idProject, idProcess, user.id);
  }

  @Mutation(() => String)
  @UseGuards(JwtAuthGuard)
  async removeProjectProcess(
    @Args('id') id: string,
    @CurrentUser() user: User,
  ): Promise<string> {
    return this.projectService.removeProjectProcess(id, user.id);
  }

  @Query(() => Category, { nullable: true })
  @UseGuards(JwtAuthGuard)
  async getCategoryById(@Args('id') id: string): Promise<Category | null> {
    return this.projectService.findCategoryById(id);
  }

  @Query(() => [Project])
  @UseGuards(JwtAuthGuard)
  async getProjectsByCategory(
    @Args('categoryId') categoryId: string,
    @CurrentUser() user: User,
  ): Promise<Project[]> {
    return this.projectService.findProjectsByCategory(categoryId, user.id);
  }

  @Query(() => [Project])
  @UseGuards(JwtAuthGuard)
  async getProjectsByUnit(
    @Args('unitId', { type: () => Number }) unitId: number,
    @CurrentUser() user: User,
  ): Promise<Project[]> {
    return this.projectService.findProjectsByUnit(unitId, user.id);
  }

  @Query(() => [User])
  @UseGuards(JwtAuthGuard)
  async getUsersNotInProject(
    @Args('projectId') projectId: string,
    @CurrentUser() user: User,
  ): Promise<User[]> {
    // Verificar que el usuario es admin del proyecto
    const isAdmin = await this.projectService.isProjectAdmin(projectId, user.id);
    if (!isAdmin) {
      throw new ForbiddenException('Solo los administradores del proyecto pueden ver usuarios no asignados');
    }
    
    return this.projectService.getUsersNotInProject(projectId);
  }
}
