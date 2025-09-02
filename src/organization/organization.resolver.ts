import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { CreateAreaInput, UpdateAreaInput } from './dto/area.dto';
import { CreateUnitInput, UpdateUnitInput } from './dto/unit.dto';
import { CreateUnitMemberInput, UpdateUnitMemberInput } from './dto/unit-member.dto';
import { CreateTypeInput, UpdateTypeInput } from './dto/type.dto';
import { CreateAdminInput } from './dto/admin.dto';
import { Area } from './entities/area.entity';
import { Unit } from './entities/unit.entity';
import { UnitMember } from './entities/unit-member.entity';
import { Type } from './entities/type.entity';
import { Admin } from './entities/admin.entity';
import { Category } from '../project/entities/category.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';

@Resolver()
@UseGuards(JwtAuthGuard)
export class OrganizationResolver {
  constructor(private readonly organizationService: OrganizationService) {}

  // ===== AREA RESOLVERS =====
  @Mutation(() => Area)
  async createArea(
    @Args('createAreaInput') createAreaInput: CreateAreaInput,
    @CurrentUser() currentUser: User,
  ) {
    return this.organizationService.createArea(createAreaInput, currentUser);
  }

  @Query(() => [Area], { name: 'areas' })
  async findAllAreas(@CurrentUser() currentUser: User) {
    return this.organizationService.findAllAreas(currentUser);
  }

  @Query(() => Area, { name: 'area' })
  async findAreaById(@Args('id', { type: () => Int }) id: number) {
    return this.organizationService.findAreaById(id);
  }

  @Mutation(() => Area)
  async updateArea(
    @Args('updateAreaInput') updateAreaInput: UpdateAreaInput,
    @CurrentUser() currentUser: User,
  ) {
    return this.organizationService.updateArea(updateAreaInput, currentUser);
  }

  @Mutation(() => Area)
  async removeArea(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() currentUser: User,
  ) {
    return this.organizationService.removeArea(id, currentUser);
  }

  // ===== UNIT RESOLVERS =====
  @Mutation(() => Unit)
  async createUnit(
    @Args('createUnitInput') createUnitInput: CreateUnitInput,
    @CurrentUser() currentUser: User,
  ) {
    return this.organizationService.createUnit(createUnitInput, currentUser);
  }

  @Query(() => [Unit], { name: 'units' })
  async findAllUnits(@CurrentUser() currentUser: User) {
    return this.organizationService.findAllUnits(currentUser);
  }

  @Query(() => Unit, { name: 'unit' })
  async findUnitById(@Args('id', { type: () => Int }) id: number) {
    return this.organizationService.findUnitById(id);
  }

  @Mutation(() => Unit)
  async updateUnit(
    @Args('updateUnitInput') updateUnitInput: UpdateUnitInput,
    @CurrentUser() currentUser: User,
  ) {
    return this.organizationService.updateUnit(updateUnitInput, currentUser);
  }

  @Mutation(() => Unit)
  async removeUnit(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() currentUser: User,
  ) {
    return this.organizationService.removeUnit(id, currentUser);
  }

  // ===== UNIT MEMBER RESOLVERS =====
  @Mutation(() => UnitMember)
  async addUnitMember(
    @Args('createUnitMemberInput') createUnitMemberInput: CreateUnitMemberInput,
    @CurrentUser() currentUser: User,
  ) {
    return this.organizationService.addUnitMember(createUnitMemberInput, currentUser);
  }

  @Mutation(() => UnitMember)
  async updateUnitMember(
    @Args('updateUnitMemberInput') updateUnitMemberInput: UpdateUnitMemberInput,
    @CurrentUser() currentUser: User,
  ) {
    return this.organizationService.updateUnitMember(updateUnitMemberInput, currentUser);
  }

  @Mutation(() => UnitMember)
  async removeUnitMember(
    @Args('id', { type: () => String }) id: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.organizationService.removeUnitMember(id, currentUser);
  }

  @Query(() => [UnitMember], { name: 'unitMembers' })
  async findUnitMembers(
    @Args('unitId', { type: () => Int }) unitId: number,
    @CurrentUser() currentUser: User
  ) {
    return this.organizationService.findUnitMembers(unitId, currentUser);
  }

  @Query(() => [User], { name: 'availableUsersForUnit' })
  async getAvailableUsersForUnit(
    @Args('unitId', { type: () => Int }) unitId: number,
    @CurrentUser() currentUser: User
  ) {
    return this.organizationService.getAvailableUsersForUnit(unitId, currentUser);
  }

  // ===== TYPE RESOLVERS =====
  @Mutation(() => Type)
  async createType(
    @Args('createTypeInput') createTypeInput: CreateTypeInput,
    @CurrentUser() currentUser: User,
  ) {
    return this.organizationService.createType(createTypeInput, currentUser);
  }

  @Query(() => [Type], { name: 'types' })
  async findAllTypes(@CurrentUser() currentUser: User) {
    return this.organizationService.findAllTypes(currentUser);
  }

  @Query(() => [Type], { name: 'myAreaTypes' })
  async getMyAreaTypes(@CurrentUser() currentUser: User) {
    return this.organizationService.getMyAreaTypes(currentUser);
  }

  @Query(() => [Category], { name: 'allCategoriesForAdmin' })
  async findAllCategoriesForAdmin(@CurrentUser() currentUser: User) {
    return this.organizationService.findAllCategoriesForAdmin(currentUser);
  }

  @Query(() => Type, { name: 'type' })
  async findTypeById(@Args('id', { type: () => Int }) id: number) {
    return this.organizationService.findTypeById(id);
  }

  @Mutation(() => Type)
  async removeType(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() currentUser: User,
  ) {
    return this.organizationService.removeType(id, currentUser);
  }

  // ===== ADMIN RESOLVERS =====
  @Query(() => [Admin], { name: 'admins' })
  async findAllAdmins() {
    return this.organizationService.findAllAdmins();
  }

  @Query(() => Admin, { name: 'admin' })
  async findAdminById(@Args('id') id: string) {
    return this.organizationService.findAdminById(id);
  }

  @Mutation(() => Admin)
  async createAdmin(
    @Args('createAdminInput') createAdminInput: CreateAdminInput,
    @CurrentUser() currentUser: User,
  ) {
    return this.organizationService.createAdmin(createAdminInput, currentUser);
  }

  @Mutation(() => String)
  async removeAdmin(
    @Args('id') id: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.organizationService.removeAdmin(id, currentUser);
  }


}
