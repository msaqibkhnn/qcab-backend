import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingRequest } from './entities/booking-request.entity';
import { CounterOffer } from './entities/counter-offer.entity';
import { RouteOffer } from '../routes/entities/route-offer.entity';
import { Trip } from '../trips/entities/trip.entity';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [TypeOrmModule.forFeature([BookingRequest, CounterOffer, RouteOffer, Trip])],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
