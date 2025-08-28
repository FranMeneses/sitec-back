import { InputType, Field, Int } from '@nestjs/graphql';
import { IsString, IsOptional, IsInt } from 'class-validator';

@InputType()
export class CreateUnitInput {
  @Field(() => String)
  @IsString()
  name: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  idtype?: number;
}

@InputType()
export class UpdateUnitInput {
  @Field(() => Int)
  @IsInt()
  id: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  idtype?: number;
}
