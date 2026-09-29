import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouteOffer } from './entities/route-offer.entity';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';

@Module({
  imports: [TypeOrmModule.forFeature([RouteOffer])],
  controllers: [RoutesController],
  providers: [RoutesService],
})
export class RoutesModule {}
