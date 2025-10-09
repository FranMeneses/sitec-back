import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class UnitMember {
  @Field(() => String)
  id: string;

  @Field(() => String, { nullable: true })
  iduser?: string;

  @Field(() => Int, { nullable: true })
  idunit?: number;

  // Las relaciones se resolverán en el resolver para evitar dependencias circulares
  // pero existen en el esquema de Prisma:
  // - user (User)
  // - unit (Unit)
}
