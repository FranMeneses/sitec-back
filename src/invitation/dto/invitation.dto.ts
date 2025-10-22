import { InputType, Field, ObjectType } from '@nestjs/graphql';
import { IsEmail, IsString, IsEnum, IsOptional } from 'class-validator';
import { Invitation } from '../entities/invitation.entity';

export enum RoleType {
  PROJECT_MEMBER = 'project_member',
  TASK_MEMBER = 'task_member',
}

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
}

@InputType()
export class CreateInvitationInput {
  @Field()
  @IsEmail()
  email: string;

  @Field()
  @IsString()
  projectId: string;

  @Field(() => String)
  @IsEnum(RoleType)
  roleType: RoleType;
}

@InputType()
export class AcceptInvitationInput {
  @Field()
  @IsString()
  token: string;
}

@ObjectType()
export class InvitationResponse {
  @Field()
  success: boolean;

  @Field({ nullable: true })
  message?: string;

  @Field(() => Invitation, { nullable: true })
  invitation?: Invitation;
}

@ObjectType()
export class InvitationListResponse {
  @Field(() => [Invitation])
  invitations: Invitation[];

  @Field()
  total: number;
}
