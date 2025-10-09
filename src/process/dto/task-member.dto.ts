import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class CreateTaskMemberInput {
  @Field(() => String)
  taskId: string;

  @Field(() => String)
  userId: string;
}

@InputType()
export class TaskMemberAssignmentInput {
  @Field(() => String)
  userId: string;
}

@InputType()
export class UpdateTaskMemberInput {
  @Field(() => String)
  id: string;

  // En el nuevo esquema, task_member solo indica pertenencia
  // No hay campos específicos que actualizar
}

@InputType()
export class UpdateTaskAsMemberInput {
  @Field(() => String)
  id: string;

  @Field(() => String, { nullable: true })
  status?: string;

  @Field(() => String, { nullable: true })
  report?: string;

  @Field(() => Int, { nullable: true })
  budget?: number;

  @Field(() => Int, { nullable: true })
  expense?: number;
}
