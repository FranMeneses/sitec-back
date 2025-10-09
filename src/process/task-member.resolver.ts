import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { UserService } from '../auth/user/user.service';
import { ProcessService } from './process.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { Task } from './entities/task.entity';
import { TaskMember } from './entities/task-member.entity';
import { UpdateTaskAsMemberInput, CreateTaskMemberInput } from './dto/task-member.dto';
import { RequireAuth, RequireUnitRole } from '../common/decorators/roles.decorator';


@Resolver(() => TaskMember)
export class TaskMemberResolver {
  constructor(
    private userService: UserService,
    private processService: ProcessService,
  ) { }

  @Query(() => [Task], { name: 'myAssignedTasks' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireAuth()
  async myAssignedTasks(
    @CurrentUser() user: User,
    @Args('includeArchived', { defaultValue: false }) includeArchived: boolean,
  ): Promise<any[]> {
    return this.userService.findUserAssignedTasks(user.id, includeArchived);
  }

  @Mutation(() => Task, { name: 'updateTaskAsMember' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireAuth()
  async updateTaskAsMember(
    @Args('updateTaskAsMemberInput') updateTaskAsMemberInput: UpdateTaskAsMemberInput,
    @CurrentUser() user: User,
  ): Promise<Task> {
    return this.processService.updateTaskAsMember(
      updateTaskAsMemberInput,
      user.id,
    );
  }

  @Mutation(() => Boolean, { name: 'assignTaskMember' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireAuth()
  async assignTaskMember(
    @Args('createTaskMemberInput') createTaskMemberInput: CreateTaskMemberInput,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    return this.processService.assignTaskMember(
      createTaskMemberInput.taskId,
      createTaskMemberInput.userId,
      user.id,
    );
  }

  @Mutation(() => Boolean, { name: 'removeTaskMember' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireAuth()
  async removeTaskMember(
    @Args('taskId') taskId: string,
    @Args('userId') userId: string,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    return this.processService.removeTaskMember(taskId, userId, user.id);
  }
}
