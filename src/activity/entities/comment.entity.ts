import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from '../../auth/entities/user.entity';
import { Task } from '../../process/entities/task.entity';

@ObjectType()
export class Comment {
  @Field(() => ID)
  id: string;

  @Field()
  text: string;

  @Field()
  createdAt: Date;

  @Field()
  userId: string;

  @Field(() => User, { nullable: true })
  user?: User;

  @Field()
  taskId: string;

  @Field(() => Task, { nullable: true })
  task?: Task;

  @Field()
  updatedAt?: Date;
}
