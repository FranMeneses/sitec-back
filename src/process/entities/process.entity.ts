import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from '../../auth/entities/user.entity';
import { Project } from '../../project/entities/project.entity';

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

  @Field()
  projectId: string;

  @Field(() => Project, { nullable: true })
  project?: Project;

  @Field()
  createdAt?: Date;

  @Field()
  updatedAt?: Date;

  // Relaciones que se resolverán después
  // @Field(() => [Task])
  // tasks?: Task[];
}
