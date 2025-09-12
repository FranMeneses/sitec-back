import { Field, ObjectType, Int } from '@nestjs/graphql';

@ObjectType()
export class RoleInfo {
  @Field(() => Int)
  id: number;

  @Field()
  name: string;
}

@ObjectType()
export class SystemRoleResponse {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field()
  isActive: boolean;

  @Field(() => RoleInfo)
  role: RoleInfo;
}

@ObjectType()
export class SuccessResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;
}