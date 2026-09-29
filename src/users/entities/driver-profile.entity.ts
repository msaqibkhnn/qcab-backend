import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

export type VerificationStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected' | 'expired';

@Entity('driver_profiles')
export class DriverProfile {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'driving_licence_number', nullable: true })
  drivingLicenceNumber?: string;

  @Column({ name: 'dvla_check_code', nullable: true })
  dvlaCheckCode?: string;

  @Column({
    name: 'dbs_status',
    type: 'enum',
    enum: ['not_submitted', 'pending', 'approved', 'rejected', 'expired'],
    default: 'not_submitted',
  })
  dbsStatus: VerificationStatus;

  @Column({ name: 'dbs_expiry_date', type: 'date', nullable: true })
  dbsExpiryDate?: string;

  @Column({
    name: 'approval_status',
    type: 'enum',
    enum: ['not_submitted', 'pending', 'approved', 'rejected', 'expired'],
    default: 'not_submitted',
  })
  approvalStatus: VerificationStatus;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt?: Date;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy?: string;

  @Column({ name: 'average_rating', type: 'numeric', precision: 3, scale: 2, default: 5.0 })
  averageRating: number;

  @Column({ name: 'is_online', default: false })
  isOnline: boolean;

  @Column({ name: 'current_lat', type: 'double precision', nullable: true })
  currentLat?: number;

  @Column({ name: 'current_lng', type: 'double precision', nullable: true })
  currentLng?: number;

  @Column({ name: 'stripe_connect_account_id', nullable: true, unique: true })
  stripeConnectAccountId?: string;

  @Column({ name: 'stripe_onboarding_complete', default: false })
  stripeOnboardingComplete: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
