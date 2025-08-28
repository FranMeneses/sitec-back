import { InputType, Field, Int } from '@nestjs/graphql';
import { IsString, IsOptional, IsInt } from 'class-validator';

@InputType()
export class CreateUnitMemberInput {
  @Field(() => String)
  @IsString()
  iduser: string;

  @Field(() => Int)
  @IsInt()
  idunit: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  idrole?: number;
}

@InputType()
export class UpdateUnitMemberInput {
  @Field(() => String)
  @IsString()
  id: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  iduser?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  idunit?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  idrole?: number;
}
