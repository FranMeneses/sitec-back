import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { SystemRoleService } from './system-role.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequireAdmin } from '../../common/decorators/roles.decorator';
import { SystemRoleResponse, SuccessResponse } from '../dto/system-role.dto';

@Resolver('SystemRole')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SystemRoleResolver {
  constructor(private readonly systemRoleService: SystemRoleService) {}

  @Query(() => [SystemRoleResponse])
  @RequireAdmin()
  async getAllSystemRoles() {
    return this.systemRoleService.getAllSystemRoles();
  }

  @Query(() => SystemRoleResponse, { nullable: true })
  @RequireAdmin()
  async getUserSystemRole(@Args('userId') userId: string) {
    return this.systemRoleService.getUserSystemRole(userId);
  }

  @Mutation(() => SuccessResponse)
  @RequireAdmin()
  async updateUserSystemRole(
    @Args('userId') userId: string,
    @Args('roleId') roleId: number,
  ) {
    await this.systemRoleService.updateUserSystemRole(userId, roleId);
    return { success: true, message: 'Rol del usuario actualizado correctamente' };
  }

  @Mutation(() => SuccessResponse)
  @RequireAdmin()
  async removeUserSystemRole(@Args('userId') userId: string) {
    await this.systemRoleService.removeUserSystemRole(userId);
    return { success: true, message: 'Rol del usuario eliminado correctamente' };
  }
}
