import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentEntity } from './entities/document.entity';
import { DriverProfile } from '../users/entities/driver-profile.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentEntity, DriverProfile, Vehicle])],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
