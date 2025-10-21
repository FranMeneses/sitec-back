import { Module } from '@nestjs/common';
import { ExportService } from './export.service';
import { ExportResolver } from './export.resolver';
import { CommonModule } from '../common/common.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [CommonModule, AuthModule],
  providers: [ExportService, ExportResolver],
  exports: [ExportService],
})
export class ExportModule {}
