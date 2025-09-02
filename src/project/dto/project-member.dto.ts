import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class CreateProjectMemberInput {
  @Field(() => String)
  projectId: string;

  @Field(() => String)
  userId: string;

  @Field(() => Int)
  roleId: number;
}

@InputType()
export class UpdateProjectMemberInput {
  @Field(() => String)
  id: string;

  @Field(() => Int, { nullable: true })
  roleId?: number;
}

@InputType()
export class AssignProcessMemberInput {
  @Field(() => String)
  processId: string;

  @Field(() => String)
  userId: string;

  @Field(() => Int)
  roleId: number;
}

@InputType()
export class RemoveProcessMemberInput {
  @Field(() => String)
  processId: string;

  @Field(() => String)
  userId: string;
}
