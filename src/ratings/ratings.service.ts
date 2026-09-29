import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rating } from './entities/rating.entity';
import { Trip } from '../trips/entities/trip.entity';
import { BookingRequest } from '../bookings/entities/booking-request.entity';
import { RouteOffer } from '../routes/entities/route-offer.entity';
import { DriverProfile } from '../users/entities/driver-profile.entity';

@Injectable()
export class RatingsService {
  constructor(
    @InjectRepository(Rating) private ratings: Repository<Rating>,
    @InjectRepository(Trip) private trips: Repository<Trip>,
    @InjectRepository(BookingRequest) private bookings: Repository<BookingRequest>,
    @InjectRepository(RouteOffer) private routeOffers: Repository<RouteOffer>,
    @InjectRepository(DriverProfile) private driverProfiles: Repository<DriverProfile>,
  ) {}

  async submit(tripId: string, raterId: string, stars: number, tags?: string[], comment?: string) {
    const trip = await this.trips.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');
    const booking = await this.bookings.findOne({ where: { id: trip.bookingRequestId } });
    if (!booking) throw new NotFoundException('Booking not found for this trip');
    const route = await this.routeOffers.findOne({ where: { id: booking.routeOfferId } });
    if (!route) throw new NotFoundException('Route offer not found for this booking');

    const rateeId = raterId === booking.riderId ? route.driverId : raterId === route.driverId ? booking.riderId : null;
    if (!rateeId) throw new BadRequestException('You were not a party to this trip');

    const rating = await this.ratings.save(this.ratings.create({ tripId, raterId, rateeId, stars, tags, comment }));

    // Recompute the driver's rolling average whenever the driver is the
    // one being rated — riders don't currently carry a displayed rating.
    if (rateeId === route.driverId) {
      const all = await this.ratings.find({ where: { rateeId } });
      const avg = all.reduce((sum, r) => sum + r.stars, 0) / all.length;
      await this.driverProfiles.update({ userId: rateeId }, { averageRating: Math.round(avg * 100) / 100 });
    }

    return rating;
  }

  async forUser(userId: string) {
    const ratings = await this.ratings.find({ where: { rateeId: userId }, order: { createdAt: 'DESC' }, take: 20 });
    const avg = ratings.length ? ratings.reduce((s, r) => s + r.stars, 0) / ratings.length : null;
    return { average: avg, recent: ratings };
  }
}
