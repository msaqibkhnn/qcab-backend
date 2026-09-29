import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Zone } from './entities/zone.entity';
import { ZonesService } from './zones.service';

@Module({
  imports: [TypeOrmModule.forFeature([Zone])],
  providers: [ZonesService],
  exports: [ZonesService],
})
export class ZonesModule {}
