import { Module } from '@nestjs/common';
import { SystemRoleService } from './system-role.service';
import { SystemRoleResolver } from './system-role.resolver';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [SystemRoleService, SystemRoleResolver],
  exports: [SystemRoleService],
})
export class SystemRoleModule {}
