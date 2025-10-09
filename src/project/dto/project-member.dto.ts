import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateProjectMemberInput {
  @Field(() => String)
  projectId: string;

  @Field(() => String)
  userId: string;
}

@InputType()
export class UpdateProjectMemberInput {
  @Field(() => String)
  id: string;

  // En el nuevo esquema, project_member solo indica pertenencia
  // No hay campos específicos que actualizar
}

@InputType()
export class AssignProcessMemberInput {
  @Field(() => String)
  processId: string;

  @Field(() => String)
  userId: string;
}

@InputType()
export class RemoveProcessMemberInput {
  @Field(() => String)
  processId: string;

  @Field(() => String)
  userId: string;
}
