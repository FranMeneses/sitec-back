import { InputType, Field, Int } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

@InputType()
export class CreateTypeInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  name: string;
}

@InputType()
export class UpdateTypeInput {
  @Field(() => Int)
  id: number;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  name?: string;
}
