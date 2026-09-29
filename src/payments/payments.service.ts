import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trip } from '../trips/entities/trip.entity';
import { BookingRequest } from '../bookings/entities/booking-request.entity';
import { RouteOffer } from '../routes/entities/route-offer.entity';
import { Zone } from '../zones/entities/zone.entity';
import { Payment } from './entities/payment.entity';
import { StripeConnectService } from './stripe-connect.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Trip) private trips: Repository<Trip>,
    @InjectRepository(BookingRequest) private bookings: Repository<BookingRequest>,
    @InjectRepository(RouteOffer) private routeOffers: Repository<RouteOffer>,
    @InjectRepository(Zone) private zones: Repository<Zone>,
    @InjectRepository(Payment) private payments: Repository<Payment>,
    private stripeConnect: StripeConnectService,
  ) {}

  async chargeForTrip(tripId: string) {
    const trip = await this.trips.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');

    const booking = await this.bookings.findOne({ where: { id: trip.bookingRequestId } });
    if (!booking) throw new NotFoundException('Booking not found for this trip');
    const route = await this.routeOffers.findOne({ where: { id: booking.routeOfferId } });
    if (!route) throw new NotFoundException('Route offer not found for this booking');
    const zone = route.zoneId ? await this.zones.findOne({ where: { id: route.zoneId } }) : null;

    const farePence = booking.finalPricePence ?? booking.requestedPricePence;
    const bookingFeePence = zone?.bookingFeePence ?? 30;
    const vatPence = zone?.vatApplicable ? Math.round(bookingFeePence * 0.2) : 0;
    const totalPence = farePence + bookingFeePence + vatPence;
    const commissionPence = Math.round(farePence * ((zone?.commissionPercent ?? 5) / 100)) + bookingFeePence + vatPence;

    const { client_secret, payment_intent_id } = await this.stripeConnect.createPaymentIntent({
      driverId: route.driverId,
      totalPence,
      commissionPence,
    });

    await this.payments.save(
      this.payments.create({
        tripId,
        riderId: booking.riderId,
        amountPence: totalPence,
        commissionPence,
        vatPence,
        status: 'pending',
        stripePaymentIntentId: payment_intent_id,
      }),
    );

    return { client_secret, payment_intent_id };
  }

  async markCaptured(paymentIntentId: string) {
    const payment = await this.payments.findOne({ where: { stripePaymentIntentId: paymentIntentId } });
    if (!payment) return;
    payment.status = 'captured';
    await this.payments.save(payment);
  }
}
