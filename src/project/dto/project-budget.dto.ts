import { InputType, Field, Int } from '@nestjs/graphql';
import { IsUUID, IsInt, Min } from 'class-validator';

@InputType()
export class UpdateProjectBudgetInput {
  @Field(() => String)
  @IsUUID()
  projectId: string;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  budget: number;
}
