import { Module } from '@nestjs/common';
import { ProcessService } from './process.service';
import { ProcessResolver } from './process.resolver';
import { TaskResolver } from './process.resolver';
import { TaskMemberResolver } from './task-member.resolver';
import { ProcessMemberResolver } from './process-member.resolver';
import { UserService } from '../auth/user/user.service';
import { SystemRoleService } from '../auth/system-role/system-role.service';

@Module({
  providers: [
    ProcessService, 
    ProcessResolver, 
    TaskResolver, 
    TaskMemberResolver,
    ProcessMemberResolver,
    UserService, 
    SystemRoleService
  ]
})
export class ProcessModule {}
