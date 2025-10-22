import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ExportService } from './export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequireAuth } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';

@Resolver()
export class ExportResolver {
  constructor(private exportService: ExportService) {}

  @Query(() => String)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireAuth()
  async exportData(
    @Args('areaId', { nullable: true }) areaId?: number,
    @CurrentUser() user?: User,
  ): Promise<string> {
    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    return this.exportService.exportDataByArea(user.id, areaId);
  }

  @Query(() => [AreaInfo])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireAuth()
  async getAvailableAreas(
    @CurrentUser() user?: User,
  ): Promise<Array<{id: number, name: string}>> {
    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    return this.exportService.getAvailableAreas(user.id);
  }
}

// Tipo GraphQL para información de área
import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
class AreaInfo {
  @Field(() => Int)
  id: number;

  @Field()
  name: string;
}
