import { Resolver, Query, Mutation, Args, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
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

@Resolver(() => Evidence)
export class EvidenceResolver {
  constructor(private activityService: ActivityService) {}

  // ==================== EVIDENCE QUERIES ====================

  @Query(() => [Evidence])
  @UseGuards(JwtAuthGuard)
  async evidence(@CurrentUser() user: User): Promise<Evidence[]> {
    return this.activityService.findAllEvidence(user.id);
  }

  @Query(() => Evidence, { nullable: true })
  @UseGuards(JwtAuthGuard)
  async evidenceById(@Args('id') id: string): Promise<Evidence | null> {
    return this.activityService.findEvidenceById(id);
  }

  @Query(() => [Evidence])
  @UseGuards(JwtAuthGuard)
  async evidenceByTask(@Args('taskId') taskId: string): Promise<Evidence[]> {
    return this.activityService.findEvidenceByTask(taskId);
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
}

@Resolver(() => Comment)
export class CommentResolver {
  constructor(private activityService: ActivityService) {}

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
  constructor(private activityService: ActivityService) {}

  // ==================== LOGS QUERIES ====================

  @Query(() => [Logs])
  @UseGuards(JwtAuthGuard)
  async logs(@CurrentUser() user: User): Promise<Logs[]> {
    return this.activityService.findAllLogs(user.id);
  }

  @Query(() => [Logs])
  @UseGuards(JwtAuthGuard)
  async logsByProject(@Args('projectId') projectId: string): Promise<Logs[]> {
    return this.activityService.findLogsByProject(projectId);
  }

  @Query(() => [Logs])
  @UseGuards(JwtAuthGuard)
  async logsByProcess(@Args('processId') processId: string): Promise<Logs[]> {
    return this.activityService.findLogsByProcess(processId);
  }

  @Query(() => [Logs])
  @UseGuards(JwtAuthGuard)
  async logsByTask(@Args('taskId') taskId: string): Promise<Logs[]> {
    return this.activityService.findLogsByTask(taskId);
  }

  @Query(() => [Logs])
  @UseGuards(JwtAuthGuard)
  async findLogsByProjectId(@Args('idProject') idProject: string): Promise<Logs[]> {
    return this.activityService.findLogsByProject(idProject);
  }

  @Query(() => [Logs])
  @UseGuards(JwtAuthGuard)
  async findLogsByTaskId(@Args('idTask') idTask: string): Promise<Logs[]> {
    return this.activityService.findLogsByTask(idTask);
  }

  @Query(() => [Logs])
  @UseGuards(JwtAuthGuard)
  async findLogsByProcessId(@Args('idProcess') idProcess: string): Promise<Logs[]> {
    return this.activityService.findLogsByProcess(idProcess);
  }

  // ==================== LOGS MUTATIONS ====================

  @Mutation(() => Logs)
  @UseGuards(JwtAuthGuard)
  async createLog(
    @Args('createLogInput') createLogInput: CreateLogInput,
    @CurrentUser() user: User,
  ): Promise<Logs> {
    return this.activityService.createLog(createLogInput, user.id);
  }
}
