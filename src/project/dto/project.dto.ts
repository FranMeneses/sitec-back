import { InputType, Field, Int } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsInt, IsDateString } from 'class-validator';

@InputType()
export class CreateProjectInput {
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

  @Field({ nullable: true })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @IsOptional()
  unitId?: number;
}

@InputType()
export class UpdateProjectInput {
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
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @IsOptional()
  unitId?: number;
}

@InputType()
export class AddProjectMemberInput {
  @Field()
  @IsUUID()
  projectId: string;

  @Field()
  @IsUUID()
  userId: string;

  @Field(() => Int)
  @IsInt()
  roleId: number;
}
