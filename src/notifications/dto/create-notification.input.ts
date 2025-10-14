import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsEnum } from 'class-validator';

export enum NotificationType {
  DAILY_SUMMARY = 'daily_summary',
  TASK_DUE_SOON = 'task_due_soon',
  TASK_OVERDUE = 'task_overdue',
  PROJECT_UPDATE = 'project_update',
  PROCESS_UPDATE = 'process_update',
  TASK_ASSIGNED = 'task_assigned',
  TASK_STATUS_CHANGED = 'task_status_changed',
  EVIDENCE_UPLOADED = 'evidence_uploaded',
  COMMENT_ADDED = 'comment_added',
  MEMBER_ADDED = 'member_added',
  MEMBER_REMOVED = 'member_removed'
}

@InputType()
export class CreateNotificationInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  userId: string;

  @Field()
  @IsEnum(NotificationType)
  type: NotificationType;

  @Field()
  @IsString()
  @IsNotEmpty()
  title: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  message: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUUID()
  relatedProjectId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUUID()
  relatedProcessId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUUID()
  relatedTaskId?: string;
}
