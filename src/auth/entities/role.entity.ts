import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

@ObjectType()
export class Role {
  @Field(() => Int)
  id: number;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  createdAt?: Date;

  @Field()
  updatedAt?: Date;
}
