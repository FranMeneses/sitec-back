import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from '../../auth/entities/user.entity';
import { Process } from './process.entity';
import { ProjectMember } from '../../project/entities/project-member.entity';

@ObjectType()
export class Task {
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

  @Field()
  status: string;

  @Field({ nullable: true })
  editedAt?: Date;

  @Field(() => User, { nullable: true })
  editor?: User;

  @Field({ nullable: true })
  memberId?: string;

  @Field(() => ProjectMember, { nullable: true })
  member?: ProjectMember;

  @Field({ nullable: true })
  report?: string;

  @Field()
  processId: string;

  @Field(() => Process, { nullable: true })
  process?: Process;

  @Field()
  createdAt?: Date;

  @Field()
  updatedAt?: Date;

  // Relaciones que se resolverán después
  // @Field(() => [Evidence])
  // evidence?: Evidence[];
  
  // @Field(() => [Comment])
  // comments?: Comment[];
}
