import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { Project } from './project.entity';
import { User } from '../../auth/entities/user.entity';
import { Role } from '../../auth/entities/role.entity';

@ObjectType()
export class ProjectMember {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  projectId: string;

  @Field(() => String)
  userId: string;

  @Field(() => Int)
  roleId: number;

  @Field(() => Date, { nullable: true })
  assignedAt?: Date;

  @Field(() => Project, { nullable: true })
  project?: Project;

  @Field(() => User, { nullable: true })
  user?: User;

  @Field(() => Role, { nullable: true })
  role?: Role;
}