import { InputType, Field, Int, ObjectType } from '@nestjs/graphql';
import { IsString, IsOptional, IsInt } from 'class-validator';

@InputType()
export class CreateAreaInput {
  @Field(() => String)
  @IsString()
  name: string;
}

@InputType()
export class UpdateAreaInput {
  @Field(() => Int)
  @IsInt()
  id: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  name?: string;
}

@ObjectType()
export class AreaUserInfo {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field()
  isActive: boolean;

  @Field()
  havePassword: boolean;

  @Field(() => String, { nullable: true })
  currentAreaName?: string;

  @Field(() => Int, { nullable: true })
  currentAreaId?: number;

  @Field()
  systemRole: string;

  @Field()
  relationshipWithArea: string; // 'admin', 'member', 'none'

  @Field()
  canBeAdded: boolean;
}

@ObjectType()
export class AreaUsersResponse {
  @Field(() => [AreaUserInfo])
  currentAreaUsers: AreaUserInfo[];

  @Field(() => [AreaUserInfo])
  availableUsers: AreaUserInfo[];

  @Field(() => Int)
  areaId: number;

  @Field()
  areaName: string;
}
