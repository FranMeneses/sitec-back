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

  @Field({ nullable: true })
  review?: string;

  @Field({ nullable: true })
  version?: number;

  @Field({ nullable: true })
  reuploadedAt?: Date;

  @Field({ nullable: true })
  archivedAt?: Date;

  @Field({ nullable: true })
  archivedBy?: string;

  @Field(() => User, { nullable: true })
  archivedByUser?: User;

  @Field()
  createdAt?: Date;

  @Field()
  updatedAt?: Date;
}
