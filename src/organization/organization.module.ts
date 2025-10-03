import { Module } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { OrganizationResolver } from './organization.resolver';
import { UnitMemberResolver } from './unit-member.resolver';
import { AreaMemberResolver } from './area-member.resolver';
import { PrismaModule } from '../common/prisma/prisma.module';
import { UserService } from '../auth/user/user.service';
import { ProjectModule } from '../project/project.module';
import { SystemRoleService } from '../auth/system-role/system-role.service';

@Module({
  imports: [
    PrismaModule,
    ProjectModule, // Importar ProjectModule para acceder a ProjectService
  ],
  providers: [
    OrganizationService, 
    OrganizationResolver, 
    UnitMemberResolver,
    AreaMemberResolver,
    UserService,
    SystemRoleService
  ],
  exports: [OrganizationService],
})
export class OrganizationModule {}
