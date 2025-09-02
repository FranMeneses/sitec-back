import { InputType, Field, Int } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsInt } from 'class-validator';

@InputType()
export class CreateAdminInput {
  @Field(() => Int)
  @IsInt()
  @IsNotEmpty()
  idArea: number;

  @Field()
  @IsString()
  @IsNotEmpty()
  idUser: string;
}

@InputType()
export class UpdateAdminInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  id: string;

  @Field(() => Int, { nullable: true })
  @IsInt()
  idArea?: number;

  @Field({ nullable: true })
  @IsString()
  idUser?: string;
}

@InputType()
export class AssignSuperAdminInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  idUser: string;
}