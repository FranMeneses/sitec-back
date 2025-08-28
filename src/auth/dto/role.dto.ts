import { InputType, Field, Int } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

@InputType()
export class CreateRoleInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  name: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  description?: string;
}

@InputType()
export class UpdateRoleInput {
  @Field(() => Int)
  id: number;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  description?: string;
}

@InputType()
export class AssignRoleInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  userId: string;

  @Field(() => Int)
  roleId: number;

  @Field(() => Int, { nullable: true })
  unitId?: number;
}
