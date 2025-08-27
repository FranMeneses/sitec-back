import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  password?: string;

  @Field()
  isActive: boolean;

  @Field()
  havePassword: boolean;

  @Field()
  createdAt?: Date;

  @Field()
  updatedAt?: Date;
}
