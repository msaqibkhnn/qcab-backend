import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('counter_offers')
export class CounterOffer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_request_id', type: 'uuid' })
  bookingRequestId: string;

  @Column({ name: 'proposed_by', type: 'uuid' })
  proposedBy: string;

  @Column({ name: 'proposed_price_pence', type: 'integer' })
  proposedPricePence: number;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ nullable: true })
  accepted?: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
