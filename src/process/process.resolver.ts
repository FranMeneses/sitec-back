import { Resolver, Query, Mutation, Args, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ProcessService } from './process.service';
import { Process } from './entities/process.entity';
import { Task } from './entities/task.entity';
import { TaskMember } from './entities/task-member.entity';
import { CreateProcessInput, UpdateProcessInput } from './dto/process.dto';
import { CreateTaskInput, UpdateTaskInput } from './dto/task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';

@Resolver(() => Process)
export class ProcessResolver {
  constructor(private processService: ProcessService) { }

  // ==================== PROCESS QUERIES ====================

  @Query(() => [Process])
  @UseGuards(JwtAuthGuard)
  async processes(@CurrentUser() user: User): Promise<Process[]> {
    return this.processService.findAllProcesses(user.id);
  }

  @Query(() => Process, { nullable: true })
  @UseGuards(JwtAuthGuard)
  async process(@Args('id') id: string): Promise<Process | null> {
    return this.processService.findProcessById(id);
  }

  @Query(() => [Process])
  @UseGuards(JwtAuthGuard)
  async processesByProject(@Args('projectId') projectId: string): Promise<Process[]> {
    return this.processService.findProcessesByProject(projectId);
  }

  @Query(() => [Task])
  @UseGuards(JwtAuthGuard)
  async findByProcessId(@Args('idProcess') idProcess: string): Promise<Task[]> {
    return this.processService.findTasksByProcess(idProcess);
  }

  // ==================== PROCESS MUTATIONS ====================

  @Mutation(() => Process)
  @UseGuards(JwtAuthGuard)
  async createProcess(
    @Args('createProcessInput') createProcessInput: CreateProcessInput,
    @CurrentUser() user: User,
  ): Promise<Process> {
    return this.processService.createProcess(createProcessInput, user.id);
  }

  @Mutation(() => Process)
  @UseGuards(JwtAuthGuard)
  async updateProcess(
    @Args('updateProcessInput') updateProcessInput: UpdateProcessInput,
    @CurrentUser() user: User,
  ): Promise<Process> {
    return this.processService.updateProcess(updateProcessInput, user.id);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteProcess(
    @Args('id') id: string,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    return this.processService.deleteProcess(id, user.id);
  }

  @Mutation(() => String)
  @UseGuards(JwtAuthGuard)
  async createProcessTask(
    @Args('idProcess') idProcess: string,
    @Args('idTask') idTask: string,
    @CurrentUser() user: User,
  ): Promise<string> {
    return this.processService.createProcessTask(idProcess, idTask, user.id);
  }

  @Mutation(() => String)
  @UseGuards(JwtAuthGuard)
  async removeProcessTask(
    @Args('id') id: string,
    @CurrentUser() user: User,
  ): Promise<string> {
    return this.processService.removeProcessTask(id, user.id);
  }

  // ==================== RESOLVE FIELDS ====================

  @ResolveField(() => [Task])
  async processTasks(@Parent() process: Process): Promise<Task[]> {
    return this.processService.findTasksByProcess(process.id);
  }
}

@Resolver(() => Task)
export class TaskResolver {
  constructor(private processService: ProcessService) { }

  // ==================== TASK QUERIES ====================

  @Query(() => [Task])
  @UseGuards(JwtAuthGuard)
  async tasks(
    @CurrentUser() user: User,
    @Args('includeArchived', { defaultValue: false }) includeArchived: boolean,
  ): Promise<Task[]> {
    return this.processService.findAllTasks(user.id, includeArchived);
  }

  @Query(() => Task, { nullable: true })
  @UseGuards(JwtAuthGuard)
  async task(
    @Args('id') id: string,
    @Args('includeArchived', { defaultValue: false }) includeArchived: boolean,
  ): Promise<Task | null> {
    return this.processService.findTaskById(id, includeArchived);
  }

  @Query(() => [Task])
  @UseGuards(JwtAuthGuard)
  async tasksByProcess(
    @Args('processId') processId: string,
    @Args('includeArchived', { defaultValue: false }) includeArchived: boolean,
  ): Promise<Task[]> {
    return this.processService.findTasksByProcess(processId, includeArchived);
  }

  @Query(() => [Task])
  @UseGuards(JwtAuthGuard)
  async findByTaskId(@Args('idTask') idTask: string): Promise<Task[]> {
    return this.processService.findTasksByTaskId(idTask);
  }

  @Query(() => [TaskMember])
  @UseGuards(JwtAuthGuard)
  async getTaskMembers(@Args('taskId') taskId: string): Promise<any[]> {
    return this.processService.getTaskMembers(taskId);
  }

  @Query(() => [User], { name: 'availableUsersForTask' })
  @UseGuards(JwtAuthGuard)
  async getAvailableUsersForTask(
    @Args('taskId') taskId: string,
    @CurrentUser() user: User
  ): Promise<any[]> {
    return this.processService.getAvailableUsersForTask(taskId, user);
  }

  // ==================== TASK MUTATIONS ====================

  @Mutation(() => Task)
  @UseGuards(JwtAuthGuard)
  async createTask(
    @Args('createTaskInput') createTaskInput: CreateTaskInput,
    @CurrentUser() user: User,
  ): Promise<Task> {
    return this.processService.createTask(createTaskInput, user.id);
  }

  @Mutation(() => Task)
  @UseGuards(JwtAuthGuard)
  async updateTask(
    @Args('updateTaskInput') updateTaskInput: UpdateTaskInput,
    @CurrentUser() user: User,
  ): Promise<Task> {
    return this.processService.updateTask(updateTaskInput, user.id);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteTask(
    @Args('id') id: string,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    return this.processService.deleteTask(id, user.id);
  }

  @Mutation(() => Task)
  @UseGuards(JwtAuthGuard)
  async archiveTask(
    @Args('id') id: string,
    @CurrentUser() user: User,
  ): Promise<Task> {
    return this.processService.archiveTaskWithEvidences(id, user.id);
  }

  @Mutation(() => Task)
  @UseGuards(JwtAuthGuard)
  async unarchiveTask(
    @Args('id') id: string,
    @CurrentUser() user: User,
  ): Promise<Task> {
    return this.processService.unarchiveTask(id, user.id);
  }

  @ResolveField(() => [TaskMember])
  async taskMembers(@Parent() task: Task): Promise<TaskMember[]> {
    return this.processService.getTaskMembers(task.id);
  }
  // ==================== TASK RESOLVE FIELDS ====================

  @ResolveField(() => Process)
  async process(@Parent() task: Task): Promise<Process | null> {
    return this.processService.findProcessById(task.processId);
  }

  // ==================== AREA_MEMBER QUERIES ====================

  @Query(() => [Process])
  @UseGuards(JwtAuthGuard)
  async getAreaProjects(@CurrentUser() user: User): Promise<any[]> {
    return this.processService.getAreaProjects(user.id);
  }

  // ==================== AREA_MEMBER MUTATIONS ====================

  @Mutation(() => Task)
  @UseGuards(JwtAuthGuard)
  async reactivateTask(
    @Args('taskId') taskId: string,
    @CurrentUser() user: User,
  ): Promise<Task> {
    return this.processService.reactivateTask(taskId, user.id);
  }
}
