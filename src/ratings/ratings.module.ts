import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rating } from './entities/rating.entity';
import { Trip } from '../trips/entities/trip.entity';
import { BookingRequest } from '../bookings/entities/booking-request.entity';
import { RouteOffer } from '../routes/entities/route-offer.entity';
import { DriverProfile } from '../users/entities/driver-profile.entity';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';

@Module({
  imports: [TypeOrmModule.forFeature([Rating, Trip, BookingRequest, RouteOffer, DriverProfile])],
  controllers: [RatingsController],
  providers: [RatingsService],
})
export class RatingsModule {}
