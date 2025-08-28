import { Module } from '@nestjs/common';
import { ProjectService } from './project/project.service';
import { ProjectResolver } from './project/project.resolver';

@Module({
  providers: [ProjectService, ProjectResolver]
})
export class ProjectModule {}
