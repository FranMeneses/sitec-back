import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { RoleService } from './role.service';
import { Role } from '../entities/role.entity';
import { CreateRoleInput, UpdateRoleInput } from '../dto/role.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { User } from '../entities/user.entity';

@Resolver(() => Role)
export class RoleResolver {
  constructor(private roleService: RoleService) {}

  @Query(() => [Role])
  @UseGuards(JwtAuthGuard)
  async roles(): Promise<Role[]> {
    return this.roleService.findAll();
  }

  @Query(() => Role, { nullable: true })
  @UseGuards(JwtAuthGuard)
  async role(@Args('id', { type: () => Int }) id: number): Promise<Role | null> {
    return this.roleService.findById(id);
  }

  @Query(() => [Role])
  @UseGuards(JwtAuthGuard)
  async myRoles(@CurrentUser() user: User): Promise<Role[]> {
    return this.roleService.getUserRoles(user.id);
  }

  @Mutation(() => Role)
  @UseGuards(JwtAuthGuard)
  async createRole(
    @Args('createRoleInput') createRoleInput: CreateRoleInput,
    @CurrentUser() user: User,
  ): Promise<Role> {
    // TODO: Agregar verificación de permisos de admin
    return this.roleService.create(createRoleInput);
  }

  @Mutation(() => Role)
  @UseGuards(JwtAuthGuard)
  async updateRole(
    @Args('updateRoleInput') updateRoleInput: UpdateRoleInput,
    @CurrentUser() user: User,
  ): Promise<Role> {
    // TODO: Agregar verificación de permisos de admin
    return this.roleService.update(updateRoleInput);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async deleteRole(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    // TODO: Agregar verificación de permisos de admin
    return this.roleService.delete(id);
  }
}
