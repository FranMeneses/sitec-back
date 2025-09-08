import { Module } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { EvidenceResolver } from './activity.resolver';
import { CommentResolver } from './activity.resolver';
import { LogsResolver } from './activity.resolver';
import { UserService } from '../auth/user/user.service';
import { SystemRoleService } from '../auth/system-role/system-role.service';
import { UploadsService } from '../uploads/uploads.service';

@Module({
  providers: [ActivityService, EvidenceResolver, CommentResolver, LogsResolver, UserService, SystemRoleService, UploadsService]
})
export class ActivityModule {}
