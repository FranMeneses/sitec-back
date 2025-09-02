import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UserService } from '../auth/user/user.service';
import { SystemRoleService } from '../auth/system-role/system-role.service';

@Module({
  imports: [PrismaModule],
  providers: [UserService, SystemRoleService],
  exports: [PrismaModule, UserService, SystemRoleService],
})
export class CommonModule {}
