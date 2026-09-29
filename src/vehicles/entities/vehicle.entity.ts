import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'driver_id' })
  driver: User;

  @Column({ name: 'driver_id', type: 'uuid' })
  driverId: string;

  @Column({ name: 'registration_no', unique: true })
  registrationNo: string;

  @Column()
  make: string;

  @Column()
  model: string;

  @Column({ nullable: true })
  colour?: string;

  @Column({ name: 'seats_available', type: 'smallint', default: 3 })
  seatsAvailable: number;

  @Column({ name: 'mot_expiry_date', type: 'date', nullable: true })
  motExpiryDate?: string;

  @Column({ name: 'insurance_expiry_date', type: 'date', nullable: true })
  insuranceExpiryDate?: string;

  @Column({ name: 'insurance_cover_type', nullable: true })
  insuranceCoverType?: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
