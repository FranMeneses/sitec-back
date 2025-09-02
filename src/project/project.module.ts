import { Module } from '@nestjs/common';
import { ProjectService } from './project/project.service';
import { ProjectResolver } from './project/project.resolver';
import { ProjectMemberResolver } from './project-member.resolver';
import { UserService } from '../auth/user/user.service';
import { SystemRoleService } from '../auth/system-role/system-role.service';

@Module({
  providers: [
    ProjectService, 
    ProjectResolver, 
    ProjectMemberResolver,
    UserService, 
    SystemRoleService
  ]
})
export class ProjectModule {}
