import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type PrivacyRequestType = 'export' | 'erasure' | 'rectification';
export type PrivacyRequestStatus = 'received' | 'in_progress' | 'completed' | 'rejected';

@Entity('privacy_requests')
export class PrivacyRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'request_type', type: 'enum', enum: ['export', 'erasure', 'rectification'] })
  requestType: PrivacyRequestType;

  @Column({ type: 'enum', enum: ['received', 'in_progress', 'completed', 'rejected'], default: 'received' })
  status: PrivacyRequestStatus;

  @Column({ name: 'statutory_due_date', type: 'date' })
  statutoryDueDate: string;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
