import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type UserRole = 'rider' | 'driver' | 'admin' | 'support_agent' | 'finance_admin' | 'super_admin';
export type UserStatus = 'active' | 'suspended' | 'pending_verification' | 'deactivated';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ['rider', 'driver', 'admin', 'support_agent', 'finance_admin', 'super_admin'] })
  role: UserRole;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ name: 'phone_number', unique: true })
  phoneNumber: string;

  @Column({ name: 'phone_verified_at', type: 'timestamptz', nullable: true })
  phoneVerifiedAt?: Date;

  @Column({ name: 'password_hash', nullable: true })
  passwordHash?: string;

  @Column({
    type: 'enum',
    enum: ['active', 'suspended', 'pending_verification', 'deactivated'],
    default: 'pending_verification',
  })
  status: UserStatus;

  @Column({ name: 'marketing_consent', default: false })
  marketingConsent: boolean;

  @Column({ name: 'emergency_contact_name', nullable: true })
  emergencyContactName?: string;

  @Column({ name: 'emergency_contact_phone', nullable: true })
  emergencyContactPhone?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
