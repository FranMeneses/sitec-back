import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequireAreaMember, RequireAreaRole } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { OrganizationService } from './organization.service';
import { AreaMember } from './entities/area-member.entity';
import { CreateAreaMemberInput } from './dto/area-member.dto';
import { Category } from '../project/entities/category.entity';
import { CreateCategoryInput, UpdateCategoryInput } from '../project/dto/category.dto';
import { ProjectService } from '../project/project/project.service';

@Resolver(() => AreaMember)
export class AreaMemberResolver {
  constructor(
    private organizationService: OrganizationService,
    private projectService: ProjectService,
  ) {}

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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireAreaRole()
  async createAreaMember(
    @Args('createAreaMemberInput') createAreaMemberInput: CreateAreaMemberInput,
    @CurrentUser() user: User,
  ): Promise<AreaMember> {
    return this.organizationService.createAreaMember(createAreaMemberInput, user);
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

  // ==================== AREA USER MANAGEMENT FOR AREA_MEMBER ====================
  // Nota: Los area_member ahora usan availableUsersForArea en lugar de getAreaUsersAsAreaMember

  // ==================== CATEGORY MANAGEMENT FOR AREA_MEMBER ====================

  @Query(() => [Category], { name: 'getCategoriesAsAreaMember' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireAreaMember()
  async getCategoriesAsAreaMember(@CurrentUser() user: User): Promise<Category[]> {
    return this.organizationService.getCategoriesAsAreaMember(user.id);
  }

  @Mutation(() => Category, { name: 'createCategoryAsAreaMember' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireAreaMember()
  async createCategoryAsAreaMember(
    @Args('createCategoryInput') createCategoryInput: CreateCategoryInput,
    @CurrentUser() user: User,
  ): Promise<Category> {
    return this.organizationService.createCategoryAsAreaMember(createCategoryInput, user.id);
  }

  @Mutation(() => Category, { name: 'updateCategoryAsAreaMember' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireAreaMember()
  async updateCategoryAsAreaMember(
    @Args('updateCategoryInput') updateCategoryInput: UpdateCategoryInput,
    @CurrentUser() user: User,
  ): Promise<Category> {
    return this.organizationService.updateCategoryAsAreaMember(updateCategoryInput, user.id);
  }

  @Mutation(() => Boolean, { name: 'deleteCategoryAsAreaMember' })
  @UseGuards(JwtAuthGuard)
  async deleteCategoryAsAreaMember(
    @Args('categoryId') categoryId: string,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    return this.organizationService.deleteCategoryAsAreaMember(categoryId, user.id);
  }
}
