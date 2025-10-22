import { ObjectType, Field, ID } from '@nestjs/graphql';
import { User } from '../../auth/entities/user.entity';

@ObjectType()
export class Invitation {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field()
  token: string;

  @Field()
  projectId: string;

  @Field()
  invitedBy: string;

  @Field()
  roleType: string;

  @Field()
  status: string;

  @Field()
  expiresAt: Date;

  @Field({ nullable: true })
  createdAt?: Date;

  @Field({ nullable: true })
  acceptedAt?: Date;

  @Field({ nullable: true })
  acceptedBy?: string;

  @Field(() => User, { nullable: true })
  inviter?: User;

  @Field(() => User, { nullable: true })
  accepter?: User;
}
