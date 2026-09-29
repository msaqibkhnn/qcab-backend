import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type NotificationChannel = 'push' | 'sms' | 'email' | 'in_app';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: ['push', 'sms', 'email', 'in_app'] })
  channel: NotificationChannel;

  @Column({ name: 'template_key' })
  templateKey: string;

  @Column({ type: 'jsonb', default: {} })
  payload: Record<string, unknown>;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt?: Date;

  @CreateDateColumn({ name: 'sent_at' })
  sentAt: Date;
}
