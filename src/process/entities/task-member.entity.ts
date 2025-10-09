import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Task } from './task.entity';
import { User } from '../../auth/entities/user.entity';

@ObjectType()
export class TaskMember {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  taskId: string;

  @Field(() => String)
  userId: string;

  @Field(() => Date, { nullable: true })
  assignedAt?: Date;

  @Field(() => Task, { nullable: true })
  task?: Task;

  @Field(() => User, { nullable: true })
  user?: User;
}
