import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Project } from './project.entity';
import { User } from '../../auth/entities/user.entity';

@ObjectType()
export class ProjectMember {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  projectId: string;

  @Field(() => String)
  userId: string;

  @Field(() => Date, { nullable: true })
  assignedAt?: Date;

  @Field(() => Project, { nullable: true })
  project?: Project;

  @Field(() => User, { nullable: true })
  user?: User;
}