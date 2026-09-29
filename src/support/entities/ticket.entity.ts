import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

export type TicketCategory = 'fare_dispute' | 'safety' | 'technical' | 'account' | 'gdpr_request' | 'other';
export type TicketStatus = 'open' | 'in_progress' | 'awaiting_user' | 'resolved' | 'closed';

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'requester_id', type: 'uuid' })
  requesterId: string;

  @Column({ type: 'enum', enum: ['fare_dispute', 'safety', 'technical', 'account', 'gdpr_request', 'other'] })
  category: TicketCategory;

  @Column({ type: 'enum', enum: ['open', 'in_progress', 'awaiting_user', 'resolved', 'closed'], default: 'open' })
  status: TicketStatus;

  @Column({ name: 'related_trip_id', type: 'uuid', nullable: true })
  relatedTripId?: string;

  @Column({ name: 'sla_due_at', type: 'timestamptz', nullable: true })
  slaDueAt?: Date;

  @Column({ name: 'assigned_agent_id', type: 'uuid', nullable: true })
  assignedAgentId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt?: Date;
}

@Entity('ticket_messages')
export class TicketMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Ticket)
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;

  @Column({ name: 'ticket_id', type: 'uuid' })
  ticketId: string;

  @Column({ name: 'sender_id', type: 'uuid' })
  senderId: string;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('disputes')
export class Dispute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ticket_id', type: 'uuid' })
  ticketId: string;

  @Column({ name: 'trip_id', type: 'uuid', nullable: true })
  tripId?: string;

  @Column({ nullable: true, type: 'enum', enum: ['refund_full', 'refund_partial', 'credit', 'no_action', 'escalated'] })
  decision?: string;

  @Column({ name: 'refund_amount_pence', type: 'integer', default: 0 })
  refundAmountPence: number;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
