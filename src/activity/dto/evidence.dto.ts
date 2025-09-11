import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsUrl, ValidateIf } from 'class-validator';

@InputType()
export class CreateEvidenceInput {
  @Field()
  @IsUUID()
  taskId: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  @IsUrl()
  link?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  review?: string;
}

@InputType()
export class UpdateEvidenceInput {
  @Field()
  @IsUUID()
  id: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  @IsUrl()
  link?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  review?: string;
}
