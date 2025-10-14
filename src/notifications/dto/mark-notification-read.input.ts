import { InputType, Field } from '@nestjs/graphql';
import { IsUUID, IsNotEmpty } from 'class-validator';

@InputType()
export class MarkNotificationReadInput {
  @Field()
  @IsUUID()
  @IsNotEmpty()
  notificationId: string;
}
