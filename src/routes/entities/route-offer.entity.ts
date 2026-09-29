import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('route_offers')
export class RouteOffer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'driver_id', type: 'uuid' })
  driverId: string;

  @Column({ name: 'vehicle_id', type: 'uuid' })
  vehicleId: string;

  @Column({ name: 'zone_id', type: 'uuid', nullable: true })
  zoneId?: string;

  @Column({ name: 'origin_lat', type: 'double precision' })
  originLat: number;

  @Column({ name: 'origin_lng', type: 'double precision' })
  originLng: number;

  @Column({ name: 'origin_label' })
  originLabel: string;

  @Column({ name: 'destination_lat', type: 'double precision' })
  destinationLat: number;

  @Column({ name: 'destination_lng', type: 'double precision' })
  destinationLng: number;

  @Column({ name: 'destination_label' })
  destinationLabel: string;

  @Column({ name: 'departure_time', type: 'timestamptz', nullable: true })
  departureTime?: Date;

  @Column({ name: 'recurrence_rule', nullable: true })
  recurrenceRule?: string;

  @Column({ name: 'seats_total', type: 'smallint' })
  seatsTotal: number;

  @Column({ name: 'seats_available', type: 'smallint' })
  seatsAvailable: number;

  @Column({ name: 'price_pence', type: 'integer' })
  pricePence: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
