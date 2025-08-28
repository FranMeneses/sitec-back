import { InputType, Field, Int } from '@nestjs/graphql';
import { IsString, IsOptional, IsInt } from 'class-validator';

@InputType()
export class CreateAreaInput {
  @Field(() => String)
  @IsString()
  name: string;
}

@InputType()
export class UpdateAreaInput {
  @Field(() => Int)
  @IsInt()
  id: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  name?: string;
}
