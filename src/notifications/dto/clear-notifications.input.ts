import { InputType, Field, Int } from '@nestjs/graphql';
import { IsOptional, IsBoolean, IsInt, Min } from 'class-validator';

@InputType()
export class ClearNotificationsInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  onlyRead?: boolean; // si true, solo elimina leídas

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  olderThanDays?: number; // si se especifica, elimina más antiguas que N días
}


