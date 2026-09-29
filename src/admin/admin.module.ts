import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { ZonesModule } from '../zones/zones.module';
import { SupportModule } from '../support/support.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [DocumentsModule, ZonesModule, SupportModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
