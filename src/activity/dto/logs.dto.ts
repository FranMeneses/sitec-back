import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsEnum } from 'class-validator';

export enum LogType {
  PROJECT_CREATED = 'project_created',
  PROJECT_UPDATED = 'project_updated',
  PROJECT_DELETED = 'project_deleted',
  PROCESS_CREATED = 'process_created',
  PROCESS_UPDATED = 'process_updated',
  PROCESS_DELETED = 'process_deleted',
  TASK_CREATED = 'task_created',
  TASK_UPDATED = 'task_updated',
  TASK_DELETED = 'task_deleted',
  TASK_ASSIGNED = 'task_assigned',
  TASK_STATUS_CHANGED = 'task_status_changed',
  TASK_REACTIVATED = 'task_reactivated',
  EVIDENCE_UPLOADED = 'evidence_uploaded',
  EVIDENCE_REPLACED = 'evidence_replaced',
  COMMENT_ADDED = 'comment_added',
  MEMBER_ADDED = 'member_added',
  MEMBER_REMOVED = 'member_removed'
}

@InputType()
export class CreateLogInput {
  @Field()
  @IsEnum(LogType)
  type: LogType;

  @Field({ nullable: true })
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @Field({ nullable: true })
  @IsUUID()
  @IsOptional()
  processId?: string;

  @Field({ nullable: true })
  @IsUUID()
  @IsOptional()
  taskId?: string;
}
