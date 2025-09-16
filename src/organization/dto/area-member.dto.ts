import { InputType, Field, Int } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsUUID, IsInt, Min } from 'class-validator';

@InputType()
export class CreateAreaMemberInput {
  @Field(() => Int)
  @IsInt()
  @Min(1)
  areaId: number;

  @Field()
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  userId: string;
}

@InputType()
export class UpdateAreaMemberInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  id: string;

  @Field(() => Int, { nullable: true })
  @IsInt()
  @Min(1)
  areaId?: number;

  @Field({ nullable: true })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  userId?: string;
}
