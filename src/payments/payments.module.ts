import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment, StripeWebhookEvent } from './entities/payment.entity';
import { Trip } from '../trips/entities/trip.entity';
import { BookingRequest } from '../bookings/entities/booking-request.entity';
import { RouteOffer } from '../routes/entities/route-offer.entity';
import { Zone } from '../zones/entities/zone.entity';
import { DriverProfile } from '../users/entities/driver-profile.entity';
import { User } from '../users/entities/user.entity';
import { PaymentsController, DriverStripeController } from './payments.controller';
import { StripeWebhookController } from './stripe-webhook.controller';
import { PaymentsService } from './payments.service';
import { StripeConnectService } from './stripe-connect.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, StripeWebhookEvent, Trip, BookingRequest, RouteOffer, Zone, DriverProfile, User]),
  ],
  controllers: [PaymentsController, DriverStripeController, StripeWebhookController],
  providers: [PaymentsService, StripeConnectService],
})
export class PaymentsModule {}
