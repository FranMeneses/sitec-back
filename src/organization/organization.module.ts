import { Module } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { OrganizationResolver } from './organization.resolver';
import { UnitMemberResolver } from './unit-member.resolver';
import { PrismaModule } from '../common/prisma/prisma.module';
import { UserService } from '../auth/user/user.service';
import { ProjectService } from '../project/project/project.service';
import { SystemRoleService } from '../auth/system-role/system-role.service';

@Module({
  imports: [PrismaModule],
  providers: [
    OrganizationService, 
    OrganizationResolver, 
    UnitMemberResolver,
    UserService,
    ProjectService,
    SystemRoleService
  ],
  exports: [OrganizationService],
})
export class OrganizationModule {}
