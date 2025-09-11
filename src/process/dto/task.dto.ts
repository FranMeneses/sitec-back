import { InputType, Field, Int } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsDateString, IsEnum, IsInt, Min, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TaskMemberAssignmentInput } from './task-member.dto';

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
  @IsInt()
  @Min(0)
  @IsOptional()
  budget?: number;

  @Field({ nullable: true })
  @IsInt()
  @Min(0)
  @IsOptional()
  expense?: number;

  @Field()
  @IsUUID()
  processId: string;

  @Field(() => [TaskMemberAssignmentInput], { nullable: true })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TaskMemberAssignmentInput)
  memberAssignments?: TaskMemberAssignmentInput[];

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
  @IsString()
  @IsOptional()
  report?: string;

  @Field({ nullable: true })
  @IsInt()
  @Min(0)
  @IsOptional()
  budget?: number;

  @Field({ nullable: true })
  @IsInt()
  @Min(0)
  @IsOptional()
  expense?: number;
}

