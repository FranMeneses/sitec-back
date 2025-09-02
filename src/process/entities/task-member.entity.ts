import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { Task } from './task.entity';
import { User } from '../../auth/entities/user.entity';
import { Role } from '../../auth/entities/role.entity';

@ObjectType()
export class TaskMember {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  taskId: string;

  @Field(() => String)
  userId: string;

  @Field(() => Int)
  roleId: number;

  @Field(() => Date, { nullable: true })
  assignedAt?: Date;

  @Field(() => Task, { nullable: true })
  task?: Task;

  @Field(() => User, { nullable: true })
  user?: User;

  @Field(() => Role, { nullable: true })
  role?: Role;
}
