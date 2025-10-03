import { Module } from '@nestjs/common';
import { ProjectService } from './project/project.service';
import { ProjectResolver } from './project/project.resolver';
import { ProjectMemberResolver } from './project-member.resolver';
import { UserService } from '../auth/user/user.service';
import { SystemRoleService } from '../auth/system-role/system-role.service';
import { ProcessModule } from '../process/process.module';

@Module({
  imports: [
    ProcessModule, // Import ProcessModule para acceder a ProcessService
  ],
  providers: [
    ProjectService, 
    ProjectResolver, 
    ProjectMemberResolver,
    UserService, 
    SystemRoleService
  ],
  exports: [ProjectService],
})
export class ProjectModule {}
