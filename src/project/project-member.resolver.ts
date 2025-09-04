import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { UserService } from '../auth/user/user.service';
import { ProjectService } from './project/project.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { ProjectMember } from './entities/project-member.entity';
import { Process } from '../process/entities/process.entity';
import { CreateProcessInput } from '../process/dto/process.dto';
import { AssignProcessMemberInput, RemoveProcessMemberInput } from './dto/project-member.dto';

@Resolver(() => ProjectMember)
export class ProjectMemberResolver {
  constructor(
    private userService: UserService,
    private projectService: ProjectService,
  ) {}

  @Query(() => [ProjectMember], { name: 'myProjectMemberships' })
  @UseGuards(JwtAuthGuard)
  async myProjectMemberships(@CurrentUser() user: User): Promise<any[]> {
    return this.userService.findUserProjectMemberships(user.id);
  }

  @Query(() => [Process], { name: 'getProjectProcessesAsMember' })
  @UseGuards(JwtAuthGuard)
  async getProjectProcessesAsMember(
    @Args('projectId') projectId: string,
    @CurrentUser() user: User,
  ): Promise<Process[]> {
    return this.projectService.getProjectProcessesAsMember(projectId, user.id);
  }

  @Mutation(() => Process, { name: 'createProcessAsProjectMember' })
  @UseGuards(JwtAuthGuard)
  async createProcessAsProjectMember(
    @Args('createProcessInput') createProcessInput: CreateProcessInput,
    @CurrentUser() user: User,
  ): Promise<Process> {
    return this.projectService.createProcessAsProjectMember(createProcessInput, user.id);
  }

  @Mutation(() => Process, { name: 'updateProcessAsProjectMember' })
  @UseGuards(JwtAuthGuard)
  async updateProcessAsProjectMember(
    @Args('processId') processId: string,
    @CurrentUser() user: User,
    @Args('name', { nullable: true }) name?: string,
    @Args('description', { nullable: true }) description?: string,
    @Args('startDate', { nullable: true }) startDate?: string,
    @Args('dueDate', { nullable: true }) dueDate?: string,
  ): Promise<Process> {
    const updateData: Partial<CreateProcessInput> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (startDate !== undefined) updateData.startDate = startDate;
    if (dueDate !== undefined) updateData.dueDate = dueDate;

    return this.projectService.updateProcessAsProjectMember(processId, updateData, user.id);
  }

}
