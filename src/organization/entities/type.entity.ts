import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class Type {
  @Field(() => Int)
  id: number;

  @Field(() => String)
  name: string;

  // La relación con Unit se resolverá en el resolver
  // pero existe en el esquema de Prisma: type -> unit[]
}
