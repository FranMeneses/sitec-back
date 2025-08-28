import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from '../../auth/entities/user.entity';
import { Task } from '../../process/entities/task.entity';

@ObjectType()
export class Evidence {
  @Field(() => ID)
  id: string;

  @Field()
  taskId: string;

  @Field(() => Task, { nullable: true })
  task?: Task;

  @Field()
  link: string;

  @Field()
  uploaderId: string;

  @Field(() => User, { nullable: true })
  uploader?: User;

  @Field()
  uploadedAt: Date;

  @Field()
  createdAt?: Date;

  @Field()
  updatedAt?: Date;
}
