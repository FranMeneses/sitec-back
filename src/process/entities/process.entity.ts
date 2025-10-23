import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from '../../auth/entities/user.entity';
import { Project } from '../../project/entities/project.entity';
import { Task } from './task.entity';

@ObjectType()
export class Process {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  startDate?: Date;

  @Field({ nullable: true })
  dueDate?: Date;

  @Field({ nullable: true })
  editedAt?: Date;

  @Field(() => User, { nullable: true })
  editor?: User;

  @Field({ nullable: true })
  review?: string;

  @Field({ nullable: true })
  archivedAt?: Date;

  @Field({ nullable: true })
  archivedBy?: string;

  @Field(() => User, { nullable: true })
  archivedByUser?: User;

  @Field({ nullable: true })
  percent?: number;

  @Field()
  projectId: string;

  @Field(() => Project, { nullable: true })
  project?: Project;

  @Field()
  createdAt?: Date;

  @Field()
  updatedAt?: Date;

  // Relaciones que se resolverán después
  @Field(() => [Task], { nullable: true })
  tasks?: Task[];
}
