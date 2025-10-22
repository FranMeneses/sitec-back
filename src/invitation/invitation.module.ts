import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { InvitationService } from './invitation.service';
import { InvitationResolver } from './invitation.resolver';
import { EmailService } from './email.service';
import { UserService } from '../auth/user/user.service';
import { SystemRoleService } from '../auth/system-role/system-role.service';

@Module({
  providers: [
    InvitationService, 
    InvitationResolver, 
    EmailService, 
    PrismaService,
    UserService,
    SystemRoleService
  ],
  exports: [InvitationService, EmailService],
})
export class InvitationModule {}
