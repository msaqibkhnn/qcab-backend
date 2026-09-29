import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Zone } from './entities/zone.entity';

@Injectable()
export class ZonesService {
  constructor(
    @InjectRepository(Zone) private zones: Repository<Zone>,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  findAll() {
    return this.zones.find();
  }

  /**
   * Admin-list-friendly view: omits the (potentially large) `boundary`
   * GeoJSON so the zones list stays small.
   */
  findAllSummary() {
    return this.dataSource.query(`
      SELECT id, name, trip_type, base_rate_pence_per_mile, booking_fee_pence,
             vat_applicable, matching_radius_miles, commission_percent, is_active, created_at
      FROM zones
      ORDER BY name ASC
    `);
  }

  async findOne(id: string) {
    const zone = await this.zones.findOne({ where: { id } });
    if (!zone) throw new NotFoundException('Zone not found');
    return zone;
  }

  /**
   * Updates the given fields via a parameterised UPDATE. `boundary`
   * (GeoJSON) is stored as jsonb.
   */
  async update(id: string, patch: {
    name?: string;
    tripType?: 'cost_share_carpool' | 'licensed_private_hire';
    baseRatePencePerMile?: number;
    bookingFeePence?: number;
    vatApplicable?: boolean;
    matchingRadiusMiles?: number;
    commissionPercent?: number;
    isActive?: boolean;
    boundaryGeoJson?: object;
  }) {
    await this.findOne(id);
    const { boundaryGeoJson, ...rest } = patch;

    const columnMap: Record<string, string> = {
      name: 'name',
      tripType: 'trip_type',
      baseRatePencePerMile: 'base_rate_pence_per_mile',
      bookingFeePence: 'booking_fee_pence',
      vatApplicable: 'vat_applicable',
      matchingRadiusMiles: 'matching_radius_miles',
      commissionPercent: 'commission_percent',
      isActive: 'is_active',
    };
    const sets: string[] = [];
    const values: any[] = [];
    Object.entries(rest).forEach(([key, value]) => {
      if (value === undefined || !columnMap[key]) return;
      values.push(value);
      sets.push(`${columnMap[key]} = $${values.length}`);
    });
    if (boundaryGeoJson) {
      values.push(JSON.stringify(boundaryGeoJson));
      sets.push(`boundary = $${values.length}::jsonb`);
    }
    if (sets.length === 0) return this.findOne(id);

    values.push(id);
    await this.dataSource.query(`UPDATE zones SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
    return this.findOne(id);
  }

  async updateCommissionConfig(id: string, commissionPercent: number, bonusTiers?: object) {
    // bonusTiers is accepted for forward-compatibility with a future
    // bonus_tiers jsonb column — not yet in qcab_schema.sql, so it's a
    // no-op today beyond validating the request shape.
    return this.update(id, { commissionPercent });
  }
}
