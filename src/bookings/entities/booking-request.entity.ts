import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type BookingStatus =
  | 'requested'
  | 'countered'
  | 'confirmed'
  | 'driver_en_route'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'disputed';

/**
 * Legal transitions out of each status. BookingsService.transition()
 * consults this map so an illegal jump (e.g. requested -> in_progress,
 * skipping acceptance) is rejected at the service layer, not left to
 * each caller to remember.
 */
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  requested: ['countered', 'confirmed', 'cancelled'],
  countered: ['confirmed', 'cancelled'],
  confirmed: ['driver_en_route', 'cancelled'],
  driver_en_route: ['arrived', 'cancelled'],
  arrived: ['in_progress', 'no_show'],
  in_progress: ['completed', 'disputed'],
  completed: ['disputed'],
  cancelled: [],
  no_show: ['disputed'],
  disputed: [],
};

@Entity('booking_requests')
export class BookingRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'route_offer_id', type: 'uuid' })
  routeOfferId: string;

  @Column({ name: 'rider_id', type: 'uuid' })
  riderId: string;

  @Column({
    type: 'enum',
    enum: ['requested', 'countered', 'confirmed', 'driver_en_route', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show', 'disputed'],
    default: 'requested',
  })
  status: BookingStatus;

  @Column({ name: 'requested_price_pence', type: 'integer' })
  requestedPricePence: number;

  @Column({ name: 'final_price_pence', type: 'integer', nullable: true })
  finalPricePence?: number;

  @Column({ name: 'pickup_otp', type: 'char', length: 4, nullable: true })
  pickupOtp?: string;

  @Column({ name: 'cancelled_by', type: 'uuid', nullable: true })
  cancelledBy?: string;

  @Column({ name: 'cancellation_reason', nullable: true })
  cancellationReason?: string;

  @CreateDateColumn({ name: 'requested_at' })
  requestedAt: Date;

  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt?: Date;
}
