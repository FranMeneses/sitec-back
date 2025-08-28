import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Admin } from './admin.entity';

@ObjectType()
export class Area {
  @Field(() => Int)
  id: number;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => [Admin], { nullable: true })
  admin?: Admin[];

  // Las categorías se resolverán en el resolver para evitar dependencias circulares
  // pero la relación existe en el esquema de Prisma
}
