import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { OrganizationService } from './organization.service';
import { AreaMember } from './entities/area-member.entity';
import { CreateAreaMemberInput } from './dto/area-member.dto';

@Resolver(() => AreaMember)
export class AreaMemberResolver {
  constructor(private organizationService: OrganizationService) {}

  // ==================== AREA_MEMBER QUERIES ====================

  @Query(() => [AreaMember])
  @UseGuards(JwtAuthGuard)
  async areaMembers(): Promise<AreaMember[]> {
    return this.organizationService.findAllAreaMembers();
  }

  @Query(() => [AreaMember])
  @UseGuards(JwtAuthGuard)
  async areaMembersByArea(@Args('areaId', { type: () => Number }) areaId: number): Promise<AreaMember[]> {
    return this.organizationService.findAreaMembersByArea(areaId);
  }

  @Query(() => [AreaMember])
  @UseGuards(JwtAuthGuard)
  async myAreaMemberships(@CurrentUser() user: User): Promise<AreaMember[]> {
    return this.organizationService.findAreaMembersByUser(user.id);
  }

  // ==================== AREA_MEMBER MUTATIONS ====================

  @Mutation(() => AreaMember)
  @UseGuards(JwtAuthGuard)
  async createAreaMember(
    @Args('createAreaMemberInput') createAreaMemberInput: CreateAreaMemberInput,
    @CurrentUser() user: User,
  ): Promise<AreaMember> {
    // TODO: Agregar verificación de permisos de admin
    return this.organizationService.createAreaMember(createAreaMemberInput);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteAreaMember(
    @Args('id') id: string,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    // TODO: Agregar verificación de permisos de admin
    return this.organizationService.deleteAreaMember(id);
  }
}
