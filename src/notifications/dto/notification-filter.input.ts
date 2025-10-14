import { InputType, Field } from '@nestjs/graphql';
import { IsOptional, IsString, IsBoolean, IsEnum } from 'class-validator';
import { NotificationType } from './create-notification.input';

@InputType()
export class NotificationFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  userId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  relatedProjectId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  relatedProcessId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  relatedTaskId?: string;
}
