import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { Process } from './process.entity';
import { User } from '../../auth/entities/user.entity';
import { Role } from '../../auth/entities/role.entity';

@ObjectType()
export class ProcessMember {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  processId: string;

  @Field(() => String)
  userId: string;

  @Field(() => Int)
  roleId: number;

  @Field(() => Date, { nullable: true })
  assignedAt?: Date;

  @Field(() => Process, { nullable: true })
  process?: Process;

  @Field(() => User, { nullable: true })
  user?: User;

  @Field(() => Role, { nullable: true })
  role?: Role;
}
