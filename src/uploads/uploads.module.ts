import { Module } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { UploadsController } from './uploads.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { UserService } from '../auth/user/user.service';
import { SystemRoleService } from '../auth/system-role/system-role.service';

@Module({
  imports: [PrismaModule],
  controllers: [UploadsController],
  providers: [UploadsService, UserService, SystemRoleService],
  exports: [UploadsService],
})
export class UploadsModule {}
