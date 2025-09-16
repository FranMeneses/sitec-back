import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Area } from './area.entity';
import { User } from '../../auth/entities/user.entity';

@ObjectType()
export class AreaMember {
  @Field(() => ID)
  id: string;

  @Field(() => Number)
  areaId: number;

  @Field(() => String)
  userId: string;

  @Field(() => Area, { nullable: true })
  area?: Area;

  @Field(() => User, { nullable: true })
  user?: User;
}
