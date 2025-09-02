import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class CreateProcessMemberInput {
  @Field(() => String)
  processId: string;

  @Field(() => String)
  userId: string;

  @Field(() => Int)
  roleId: number;
}

@InputType()
export class UpdateProcessMemberInput {
  @Field(() => String)
  id: string;

  @Field(() => Int, { nullable: true })
  roleId?: number;
}

@InputType()
export class AssignTaskMemberInput {
  @Field(() => String)
  taskId: string;

  @Field(() => String)
  userId: string;

  @Field(() => Int)
  roleId: number;
}

@InputType()
export class RemoveTaskMemberInput {
  @Field(() => String)
  taskId: string;

  @Field(() => String)
  userId: string;
}
