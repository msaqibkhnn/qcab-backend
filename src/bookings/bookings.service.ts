import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingRequest, BOOKING_TRANSITIONS, BookingStatus } from './entities/booking-request.entity';
import { CounterOffer } from './entities/counter-offer.entity';
import { RouteOffer } from '../routes/entities/route-offer.entity';
import { Trip } from '../trips/entities/trip.entity';

function generateOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(BookingRequest) private bookings: Repository<BookingRequest>,
    @InjectRepository(CounterOffer) private counterOffers: Repository<CounterOffer>,
    @InjectRepository(RouteOffer) private routeOffers: Repository<RouteOffer>,
    @InjectRepository(Trip) private trips: Repository<Trip>,
  ) {}

  /** Moves a booking to `to`, throwing if the transition isn't allowed from its current state. */
  private async transition(id: string, to: BookingStatus): Promise<BookingRequest> {
    const booking = await this.bookings.findOne({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');

    const allowed = BOOKING_TRANSITIONS[booking.status];
    if (!allowed.includes(to)) {
      throw new BadRequestException(`Cannot move booking from '${booking.status}' to '${to}'`);
    }
    booking.status = to;
    booking.respondedAt = new Date();
    return this.bookings.save(booking);
  }

  async create(riderId: string, routeOfferId: string, requestedPricePence: number) {
    const route = await this.routeOffers.findOne({ where: { id: routeOfferId } });
    if (!route || !route.isActive || route.seatsAvailable < 1) {
      throw new BadRequestException('This route is no longer available');
    }
    const booking = this.bookings.create({
      routeOfferId,
      riderId,
      requestedPricePence,
      status: 'requested',
      pickupOtp: generateOtp(),
    });
    return this.bookings.save(booking);
  }

  async accept(id: string) {
    const booking = await this.transition(id, 'confirmed');
    booking.finalPricePence = booking.finalPricePence ?? booking.requestedPricePence;
    await this.bookings.save(booking);

    // Decrement the route's available seats now the seat is committed.
    await this.routeOffers.decrement({ id: booking.routeOfferId }, 'seatsAvailable', 1);
    return booking;
  }

  async counterOffer(id: string, proposedBy: string, proposedPricePence: number) {
    await this.transition(id, 'countered');
    const offer = this.counterOffers.create({
      bookingRequestId: id,
      proposedBy,
      proposedPricePence,
      expiresAt: new Date(Date.now() + 2 * 60 * 1000), // 2-minute expiry, matches the app's countdown UI
    });
    return this.counterOffers.save(offer);
  }

  async acceptCounterOffer(counterOfferId: string) {
    const offer = await this.counterOffers.findOne({ where: { id: counterOfferId } });
    if (!offer) throw new NotFoundException('Counter-offer not found');
    if (offer.expiresAt < new Date()) throw new BadRequestException('This counter-offer has expired');

    offer.accepted = true;
    await this.counterOffers.save(offer);

    const booking = await this.bookings.findOne({ where: { id: offer.bookingRequestId } });
    if (!booking) throw new NotFoundException('Booking not found for this counter-offer');
    booking.finalPricePence = offer.proposedPricePence;
    booking.status = 'confirmed';
    await this.bookings.save(booking);
    await this.routeOffers.decrement({ id: booking.routeOfferId }, 'seatsAvailable', 1);
    return booking;
  }

  async cancel(id: string, cancelledBy: string, reason?: string) {
    const booking = await this.transition(id, 'cancelled');
    booking.cancelledBy = cancelledBy;
    booking.cancellationReason = reason;
    return this.bookings.save(booking);
  }

  startTrip(id: string) {
    return this.transition(id, 'driver_en_route');
  }

  markArrived(id: string) {
    return this.transition(id, 'arrived');
  }

  async markInProgress(id: string) {
    const booking = await this.transition(id, 'in_progress');
    const existing = await this.trips.findOne({ where: { bookingRequestId: id } });
    if (!existing) {
      await this.trips.save(
        this.trips.create({
          bookingRequestId: id,
          startedAt: new Date(),
          fareBreakdown: {
            cost_share_pence: booking.finalPricePence ?? booking.requestedPricePence,
            booking_fee_pence: 0,
            vat_pence: 0,
            total_pence: booking.finalPricePence ?? booking.requestedPricePence,
          },
        }),
      );
    }
    return booking;
  }

  complete(id: string) {
    return this.transition(id, 'completed');
  }
}
