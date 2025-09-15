import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { Area } from '../../organization/entities/area.entity';

@ObjectType()
export class Category {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Int, { nullable: true })
  areaId?: number;

  @Field(() => Area, { nullable: true })
  area?: Area;

  @Field()
  createdAt?: Date;

  @Field()
  updatedAt?: Date;

  // Relaciones que se resolverán después
  // @Field(() => [Project])
  // projects?: Project[];
}
