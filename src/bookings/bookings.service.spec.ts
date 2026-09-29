import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BookingsService } from './bookings.service';
import { BookingRequest } from './entities/booking-request.entity';
import { CounterOffer } from './entities/counter-offer.entity';
import { RouteOffer } from '../routes/entities/route-offer.entity';
import { Trip } from '../trips/entities/trip.entity';

/**
 * A minimal in-memory stand-in for a TypeORM Repository<T>, keyed by id.
 * Covers exactly the methods BookingsService calls — findOne, create,
 * save, decrement — so these tests exercise the service's own logic
 * (the state machine, the seat decrement, the OTP generation) without
 * needing a real database.
 */
function fakeRepo<T extends { id?: string }>() {
  const rows = new Map<string, any>();
  let counter = 0;
  return {
    _rows: rows,
    create: jest.fn((partial: any) => ({ ...partial })),
    save: jest.fn(async (entity: any) => {
      if (!entity.id) entity.id = `id-${++counter}`;
      rows.set(entity.id, entity);
      return entity;
    }),
    findOne: jest.fn(async ({ where }: any) => {
      if (where.id) return rows.get(where.id) ?? null;
      if (where.bookingRequestId) {
        return [...rows.values()].find((r) => r.bookingRequestId === where.bookingRequestId) ?? null;
      }
      return null;
    }),
    decrement: jest.fn(async ({ id }: any, field: string, by: number) => {
      const row = rows.get(id);
      if (row) row[field] -= by;
    }),
    seed: (entity: any) => rows.set(entity.id, entity),
  };
}

describe('BookingsService', () => {
  let service: BookingsService;
  let bookings: ReturnType<typeof fakeRepo>;
  let counterOffers: ReturnType<typeof fakeRepo>;
  let routeOffers: ReturnType<typeof fakeRepo>;
  let trips: ReturnType<typeof fakeRepo>;

  beforeEach(async () => {
    bookings = fakeRepo();
    counterOffers = fakeRepo();
    routeOffers = fakeRepo();
    trips = fakeRepo();

    const moduleRef = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: getRepositoryToken(BookingRequest), useValue: bookings },
        { provide: getRepositoryToken(CounterOffer), useValue: counterOffers },
        { provide: getRepositoryToken(RouteOffer), useValue: routeOffers },
        { provide: getRepositoryToken(Trip), useValue: trips },
      ],
    }).compile();

    service = moduleRef.get(BookingsService);
  });

  function seedRoute(overrides: Partial<RouteOffer> = {}) {
    routeOffers.seed({ id: 'route-1', driverId: 'driver-1', isActive: true, seatsAvailable: 2, ...overrides });
  }

  describe('create', () => {
    it('rejects a booking on a route with no seats left', async () => {
      seedRoute({ seatsAvailable: 0 });
      await expect(service.create('rider-1', 'route-1', 500)).rejects.toThrow(BadRequestException);
    });

    it('rejects a booking on an inactive route', async () => {
      seedRoute({ isActive: false });
      await expect(service.create('rider-1', 'route-1', 500)).rejects.toThrow(BadRequestException);
    });

    it('creates a requested booking with a 4-digit pickup OTP', async () => {
      seedRoute();
      const booking = await service.create('rider-1', 'route-1', 500);
      expect(booking.status).toBe('requested');
      expect(booking.pickupOtp).toMatch(/^\d{4}$/);
    });
  });

  describe('state machine transitions', () => {
    it('accept() moves requested -> confirmed and decrements route seats', async () => {
      seedRoute();
      const booking = await service.create('rider-1', 'route-1', 500);
      const accepted = await service.accept(booking.id);

      expect(accepted.status).toBe('confirmed');
      expect(accepted.finalPricePence).toBe(500);
      expect(routeOffers._rows.get('route-1').seatsAvailable).toBe(1);
    });

    it('rejects an illegal transition (completed booking cannot be re-accepted)', async () => {
      seedRoute();
      const booking = await service.create('rider-1', 'route-1', 500);
      await service.accept(booking.id);
      await service.startTrip(booking.id);
      await service.markArrived(booking.id);
      await service.markInProgress(booking.id);
      await service.complete(booking.id);

      await expect(service.accept(booking.id)).rejects.toThrow(BadRequestException);
    });

    it('cancelled bookings cannot transition further', async () => {
      seedRoute();
      const booking = await service.create('rider-1', 'route-1', 500);
      await service.cancel(booking.id, 'rider-1', 'change of plan');

      await expect(service.accept(booking.id)).rejects.toThrow(BadRequestException);
    });

    it('markInProgress creates exactly one Trip row even if called twice', async () => {
      seedRoute();
      const booking = await service.create('rider-1', 'route-1', 500);
      await service.accept(booking.id);
      await service.startTrip(booking.id);
      await service.markArrived(booking.id);

      await service.markInProgress(booking.id);
      await service.markInProgress(booking.id).catch(() => {
        // second call is expected to fail the state-machine check
        // (in_progress -> in_progress isn't a listed transition) —
        // the assertion below on trip count is what actually matters here.
      });

      const tripCount = [...trips._rows.values()].filter((t) => t.bookingRequestId === booking.id).length;
      expect(tripCount).toBe(1);
    });

    it('transition() throws NotFoundException for an unknown booking id', async () => {
      await expect(service.accept('does-not-exist')).rejects.toThrow(NotFoundException);
    });
  });

  describe('counter-offers', () => {
    it('counterOffer() moves the booking to countered and stores a 2-minute-expiry offer', async () => {
      seedRoute();
      const booking = await service.create('rider-1', 'route-1', 500);
      const offer = await service.counterOffer(booking.id, 'driver-1', 650);

      expect(bookings._rows.get(booking.id).status).toBe('countered');
      expect(offer.proposedPricePence).toBe(650);
      expect(offer.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('acceptCounterOffer() confirms the booking at the countered price and decrements seats', async () => {
      seedRoute();
      const booking = await service.create('rider-1', 'route-1', 500);
      const offer = await service.counterOffer(booking.id, 'driver-1', 650);

      const confirmed = await service.acceptCounterOffer(offer.id);
      expect(confirmed.status).toBe('confirmed');
      expect(confirmed.finalPricePence).toBe(650);
      expect(routeOffers._rows.get('route-1').seatsAvailable).toBe(1);
    });

    it('acceptCounterOffer() rejects an expired offer', async () => {
      seedRoute();
      const booking = await service.create('rider-1', 'route-1', 500);
      const offer = await service.counterOffer(booking.id, 'driver-1', 650);
      offer.expiresAt = new Date(Date.now() - 1000); // force expiry
      counterOffers._rows.set(offer.id, offer);

      await expect(service.acceptCounterOffer(offer.id)).rejects.toThrow(BadRequestException);
    });
  });
});
