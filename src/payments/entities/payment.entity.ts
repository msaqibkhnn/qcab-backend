import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, PrimaryColumn } from 'typeorm';

export type PaymentStatus = 'pending' | 'authorised' | 'captured' | 'refunded' | 'failed';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trip_id', type: 'uuid' })
  tripId: string;

  @Column({ name: 'rider_id', type: 'uuid' })
  riderId: string;

  @Column({ name: 'amount_pence', type: 'integer' })
  amountPence: number;

  @Column({ name: 'commission_pence', type: 'integer' })
  commissionPence: number;

  @Column({ name: 'vat_pence', type: 'integer', default: 0 })
  vatPence: number;

  @Column({ type: 'enum', enum: ['pending', 'authorised', 'captured', 'refunded', 'failed'], default: 'pending' })
  status: PaymentStatus;

  @Column({ name: 'stripe_payment_intent_id', nullable: true, unique: true })
  stripePaymentIntentId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('stripe_webhook_events')
export class StripeWebhookEvent {
  @PrimaryColumn({ name: 'stripe_event_id' })
  stripeEventId: string;

  @Column({ name: 'event_type' })
  eventType: string;

  @CreateDateColumn({ name: 'processed_at' })
  processedAt: Date;
}
