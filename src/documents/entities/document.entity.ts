import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type DocumentType =
  | 'driving_licence'
  | 'dbs_check'
  | 'passport_or_brp'
  | 'proof_of_address'
  | 'vehicle_v5c'
  | 'vehicle_mot'
  | 'vehicle_insurance'
  | 'right_to_work';

export type VerificationStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected' | 'expired';

@Entity('documents')
export class DocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId?: string;

  @Column({ name: 'owner_vehicle_id', type: 'uuid', nullable: true })
  ownerVehicleId?: string;

  @Column({ name: 'doc_type', type: 'enum', enum: [
    'driving_licence', 'dbs_check', 'passport_or_brp', 'proof_of_address',
    'vehicle_v5c', 'vehicle_mot', 'vehicle_insurance', 'right_to_work',
  ] })
  docType: DocumentType;

  @Column({ name: 'file_url' })
  fileUrl: string;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate?: string;

  @Column({
    type: 'enum',
    enum: ['not_submitted', 'pending', 'approved', 'rejected', 'expired'],
    default: 'pending',
  })
  status: VerificationStatus;

  @Column({ name: 'rejection_reason', nullable: true })
  rejectionReason?: string;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy?: string;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt?: Date;

  @CreateDateColumn({ name: 'submitted_at' })
  submittedAt: Date;
}
