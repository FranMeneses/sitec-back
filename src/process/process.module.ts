import { Module } from '@nestjs/common';
import { ProcessService } from './process.service';
import { ProcessResolver } from './process.resolver';
import { TaskResolver } from './process.resolver';

@Module({
  providers: [ProcessService, ProcessResolver, TaskResolver]
})
export class ProcessModule {}
