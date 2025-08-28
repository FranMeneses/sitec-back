import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class Admin {
  @Field(() => String)
  id: string;

  @Field(() => Int, { nullable: true })
  idarea?: number;

  @Field(() => String, { nullable: true })
  iduser?: string;

  // Las relaciones se resolverán en el resolver para evitar dependencias circulares
  // pero existen en el esquema de Prisma:
  // - area (Area)
  // - user (User)
}
