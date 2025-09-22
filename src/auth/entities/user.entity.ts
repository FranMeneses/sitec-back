import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { Role } from './role.entity';

@ObjectType()
export class SystemRole {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field()
  roleId: number;

  @Field()
  createdAt: Date;

  @Field(() => Role)
  role: Role;
}

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  password?: string;

  @Field()
  isActive: boolean;

  @Field()
  havePassword: boolean;

  @Field(() => SystemRole, { nullable: true })
  systemRole?: SystemRole;

  @Field()
  createdAt?: Date;

  @Field()
  updatedAt?: Date;
}