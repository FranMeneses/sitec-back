import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { User } from '../../auth/entities/user.entity';
import { Role } from '../../auth/entities/role.entity';
import { Project } from './project.entity';

@ObjectType()
export class ProjectMember {
  @Field(() => ID)
  id: string;

  @Field(() => User, { nullable: true })
  user?: User;

  @Field(() => Project, { nullable: true })
  project?: Project;

  @Field(() => Role, { nullable: true })
  role?: Role;

  @Field({ nullable: true })
  userId?: string;

  @Field({ nullable: true })
  projectId?: string;

  @Field(() => Int, { nullable: true })
  roleId?: number;

  @Field()
  createdAt?: Date;

  @Field()
  updatedAt?: Date;
}
