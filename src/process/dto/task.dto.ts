import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsDateString, IsEnum } from 'class-validator';

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  REVIEW = 'review',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

@InputType()
export class CreateTaskInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  name: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Field({ nullable: true })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @Field({ nullable: true })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @Field()
  @IsEnum(TaskStatus)
  status: TaskStatus;

  @Field({ nullable: true })
  @IsUUID()
  @IsOptional()
  memberId?: string;

  @Field()
  @IsUUID()
  processId: string;
}

@InputType()
export class UpdateTaskInput {
  @Field()
  @IsUUID()
  id: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Field({ nullable: true })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @Field({ nullable: true })
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @Field({ nullable: true })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @Field({ nullable: true })
  @IsUUID()
  @IsOptional()
  memberId?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  report?: string;
}

@InputType()
export class AssignTaskInput {
  @Field()
  @IsUUID()
  taskId: string;

  @Field()
  @IsUUID()
  memberId: string;
}
