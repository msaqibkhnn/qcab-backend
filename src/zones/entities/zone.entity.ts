import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type TripType = 'cost_share_carpool' | 'licensed_private_hire';

@Entity('zones')
export class Zone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  // GeoJSON Polygon stored as jsonb (cPanel build: no PostGIS). This is
  // informational for the admin console; ride matching uses the zone's
  // matching_radius_miles, not point-in-polygon.
  @Column({ type: 'jsonb', nullable: true })
  boundary?: object | null;

  @Column({ name: 'trip_type', type: 'enum', enum: ['cost_share_carpool', 'licensed_private_hire'], default: 'cost_share_carpool' })
  tripType: TripType;

  @Column({ name: 'base_rate_pence_per_mile', type: 'integer' })
  baseRatePencePerMile: number;

  @Column({ name: 'booking_fee_pence', type: 'integer', default: 0 })
  bookingFeePence: number;

  @Column({ name: 'vat_applicable', default: true })
  vatApplicable: boolean;

  @Column({ name: 'matching_radius_miles', type: 'numeric', precision: 4, scale: 2, default: 3.0 })
  matchingRadiusMiles: number;

  @Column({ name: 'commission_percent', type: 'numeric', precision: 5, scale: 2, default: 5.0 })
  commissionPercent: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
