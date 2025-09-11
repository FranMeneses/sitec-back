import { Module } from '@nestjs/common';
import { ActivityService } from './activity.service';
// TEMPORALMENTE COMENTADO - FUNCIONALIDAD DE EVIDENCIAS DESHABILITADA PARA EL SPRINT ACTUAL
// import { EvidenceResolver } from './activity.resolver';
import { CommentResolver } from './activity.resolver';
import { LogsResolver } from './activity.resolver';
import { UserService } from '../auth/user/user.service';
import { SystemRoleService } from '../auth/system-role/system-role.service';
// TEMPORALMENTE COMENTADO - FUNCIONALIDAD DE UPLOADS DESHABILITADA PARA EL SPRINT ACTUAL
// import { UploadsService } from '../uploads/uploads.service';

@Module({
  providers: [
    ActivityService, 
    // TEMPORALMENTE COMENTADO - FUNCIONALIDAD DE EVIDENCIAS DESHABILITADA PARA EL SPRINT ACTUAL
    // EvidenceResolver, 
    CommentResolver, 
    LogsResolver, 
    UserService, 
    SystemRoleService, 
    // TEMPORALMENTE COMENTADO - FUNCIONALIDAD DE UPLOADS DESHABILITADA PARA EL SPRINT ACTUAL
    // UploadsService
  ]
})
export class ActivityModule {}
