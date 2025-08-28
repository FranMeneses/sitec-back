import { Module } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { EvidenceResolver } from './activity.resolver';
import { CommentResolver } from './activity.resolver';
import { LogsResolver } from './activity.resolver';

@Module({
  providers: [ActivityService, EvidenceResolver, CommentResolver, LogsResolver]
})
export class ActivityModule {}
