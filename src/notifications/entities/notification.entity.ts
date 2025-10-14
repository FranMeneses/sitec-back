import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from '../../auth/entities/user.entity';
import { Project } from '../../project/entities/project.entity';
import { Process } from '../../process/entities/process.entity';
import { Task } from '../../process/entities/task.entity';

@ObjectType()
export class Notification {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field(() => User, { nullable: true })
  user?: User;

  @Field()
  type: string;

  @Field()
  title: string;

  @Field()
  message: string;

  @Field()
  isRead: boolean;

  @Field()
  createdAt: Date;

  @Field({ nullable: true })
  relatedProjectId?: string;

  @Field(() => Project, { nullable: true })
  project?: Project;

  @Field({ nullable: true })
  relatedProcessId?: string;

  @Field(() => Process, { nullable: true })
  process?: Process;

  @Field({ nullable: true })
  relatedTaskId?: string;

  @Field(() => Task, { nullable: true })
  task?: Task;
}
