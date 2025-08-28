import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ProjectService } from './project.service';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { CreateProjectInput, UpdateProjectInput, AddProjectMemberInput } from '../dto/project.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../auth/entities/user.entity';

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
}
