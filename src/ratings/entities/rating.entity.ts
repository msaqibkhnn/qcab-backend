import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';

@Entity('ratings')
@Unique(['tripId', 'raterId'])
export class Rating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'trip_id', type: 'uuid' })
  tripId: string;

  @Column({ name: 'rater_id', type: 'uuid' })
  raterId: string;

  @Column({ name: 'ratee_id', type: 'uuid' })
  rateeId: string;

  @Column({ type: 'smallint' })
  stars: number;

  @Column({ type: 'text', array: true, nullable: true })
  tags?: string[];

  @Column({ nullable: true })
  comment?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
