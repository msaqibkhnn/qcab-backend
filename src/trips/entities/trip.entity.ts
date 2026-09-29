import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export interface FareBreakdown {
  cost_share_pence: number;
  booking_fee_pence: number;
  vat_pence: number;
  tip_pence?: number;
  total_pence: number;
}

@Entity('trips')
export class Trip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_request_id', type: 'uuid', unique: true })
  bookingRequestId: string;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt?: Date;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt?: Date;

  @Column({ name: 'distance_metres', type: 'integer', nullable: true })
  distanceMetres?: number;

  @Column({ name: 'duration_seconds', type: 'integer', nullable: true })
  durationSeconds?: number;

  @Column({ name: 'fare_breakdown', type: 'jsonb', default: {} })
  fareBreakdown: FareBreakdown;

  @Column({ name: 'sos_triggered', default: false })
  sosTriggered: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
