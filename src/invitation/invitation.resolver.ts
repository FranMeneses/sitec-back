import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InvitationService } from './invitation.service';
import { CreateInvitationInput, AcceptInvitationInput, InvitationResponse, InvitationListResponse } from './dto/invitation.dto';
import { Invitation } from './entities/invitation.entity';

@Resolver(() => Invitation)
export class InvitationResolver {
  constructor(private invitationService: InvitationService) {}

  @Mutation(() => InvitationResponse)
  @UseGuards(JwtAuthGuard)
  async createInvitation(
    @Args('createInvitationInput') createInvitationInput: CreateInvitationInput,
    @Context() context: any,
  ): Promise<InvitationResponse> {
    const userId = context.req.user.id;
    return this.invitationService.createInvitation(createInvitationInput, userId);
  }

  @Query(() => InvitationResponse)
  async validateInvitation(
    @Args('acceptInvitationInput') acceptInvitationInput: AcceptInvitationInput,
  ): Promise<InvitationResponse> {
    return this.invitationService.acceptInvitation(acceptInvitationInput);
  }

  @Mutation(() => InvitationResponse)
  @UseGuards(JwtAuthGuard)
  async acceptInvitation(
    @Args('acceptInvitationInput') acceptInvitationInput: AcceptInvitationInput,
    @Context() context: any,
  ): Promise<InvitationResponse> {
    const userId = context.req.user.id;
    return this.invitationService.processInvitationAcceptance(acceptInvitationInput.token, userId);
  }

  @Query(() => InvitationListResponse)
  @UseGuards(JwtAuthGuard)
  async getProjectInvitations(
    @Args('projectId') projectId: string,
    @Context() context: any,
  ): Promise<InvitationListResponse> {
    // Verificar que el usuario tiene permisos para ver las invitaciones del proyecto
    const userId = context.req.user.id;
    const canView = await this.invitationService.canUserInviteToProject(userId, projectId);
    if (!canView) {
      throw new Error('No tienes permisos para ver las invitaciones de este proyecto');
    }

    return this.invitationService.getInvitationsByProject(projectId);
  }

  @Mutation(() => InvitationResponse)
  @UseGuards(JwtAuthGuard)
  async cancelInvitation(
    @Args('invitationId') invitationId: string,
    @Context() context: any,
  ): Promise<InvitationResponse> {
    const userId = context.req.user.id;
    return this.invitationService.cancelInvitation(invitationId, userId);
  }
}
