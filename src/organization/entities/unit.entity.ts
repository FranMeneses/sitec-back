import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Type } from './type.entity';
import { UnitMember } from './unit-member.entity';

@ObjectType()
export class Unit {
  @Field(() => Int)
  id: number;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => Int, { nullable: true })
  idtype?: number;

  @Field(() => Type, { nullable: true })
  type?: Type;

  // Los proyectos se resolverán en el resolver para evitar dependencias circulares
  // pero la relación existe en el esquema de Prisma

  @Field(() => [UnitMember], { nullable: true })
  unit_member?: UnitMember[];
}
