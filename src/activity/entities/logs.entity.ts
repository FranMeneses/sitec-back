import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from '../../auth/entities/user.entity';
import { Project } from '../../project/entities/project.entity';
import { Process } from '../../process/entities/process.entity';
import { Task } from '../../process/entities/task.entity';

@ObjectType()
export class Logs {
  @Field(() => ID)
  id: string;

  @Field()
  type: string;

  @Field()
  createdAt: Date;

  @Field()
  creatorId: string;

  @Field(() => User, { nullable: true })
  creator?: User;

  @Field({ nullable: true })
  projectId?: string;

  @Field(() => Project, { nullable: true })
  project?: Project;

  @Field({ nullable: true })
  processId?: string;

  @Field(() => Process, { nullable: true })
  process?: Process;

  @Field({ nullable: true })
  taskId?: string;

  @Field(() => Task, { nullable: true })
  task?: Task;

  @Field()
  updatedAt?: Date;
}
