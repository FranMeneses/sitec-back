import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { UserService } from '../auth/user/user.service';
import { ProcessService } from './process.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { Task } from './entities/task.entity';
import { ProcessMember } from './entities/process-member.entity';
import { CreateTaskInput } from './dto/task.dto';
import { AssignTaskMemberInput, RemoveTaskMemberInput } from './dto/process-member.dto';

@Resolver(() => ProcessMember)
export class ProcessMemberResolver {
  constructor(
    private userService: UserService,
    private processService: ProcessService,
  ) {}

  @Query(() => [ProcessMember], { name: 'myProcessMemberships' })
  @UseGuards(JwtAuthGuard)
  async myProcessMemberships(@CurrentUser() user: User): Promise<any[]> {
    return this.userService.findUserProcessMemberships(user.id);
  }

  @Query(() => [Task], { name: 'getProcessTasksAsMember' })
  @UseGuards(JwtAuthGuard)
  async getProcessTasksAsMember(
    @Args('processId') processId: string,
    @CurrentUser() user: User,
  ): Promise<Task[]> {
    return this.processService.getProcessTasksAsMember(processId, user.id);
  }

  @Mutation(() => Task, { name: 'createTaskAsProcessMember' })
  @UseGuards(JwtAuthGuard)
  async createTaskAsProcessMember(
    @Args('createTaskInput') createTaskInput: CreateTaskInput,
    @CurrentUser() user: User,
  ): Promise<Task> {
    return this.processService.createTaskAsProcessMember(createTaskInput, user.id);
  }

  @Mutation(() => Boolean, { name: 'assignTaskMember' })
  @UseGuards(JwtAuthGuard)
  async assignTaskMember(
    @Args('assignTaskMemberInput') assignTaskMemberInput: AssignTaskMemberInput,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    return this.processService.assignTaskMember(
      assignTaskMemberInput.taskId,
      assignTaskMemberInput.userId,
      assignTaskMemberInput.roleId,
      user.id,
    );
  }

  @Mutation(() => Boolean, { name: 'removeTaskMember' })
  @UseGuards(JwtAuthGuard)
  async removeTaskMember(
    @Args('removeTaskMemberInput') removeTaskMemberInput: RemoveTaskMemberInput,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    return this.processService.removeTaskMember(
      removeTaskMemberInput.taskId,
      removeTaskMemberInput.userId,
      user.id,
    );
  }
}
