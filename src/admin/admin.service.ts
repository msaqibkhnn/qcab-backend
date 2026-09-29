import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminService {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  /**
   * Dashboard KPI strip (Section 8). Deliberately simple aggregate
   * queries rather than a materialized view or a reporting service —
   * fine at this scale, worth revisiting once trip volume makes these
   * queries slow.
   */
  async dashboard() {
    const [tripsToday] = await this.dataSource.query(`
      SELECT count(*)::int AS count FROM trips WHERE started_at::date = current_date
    `);
    const [gmvToday] = await this.dataSource.query(`
      SELECT COALESCE(sum(amount_pence), 0)::bigint AS pence
      FROM payments WHERE created_at::date = current_date AND status = 'captured'
    `);
    const [commissionToday] = await this.dataSource.query(`
      SELECT COALESCE(sum(commission_pence), 0)::bigint AS pence
      FROM payments WHERE created_at::date = current_date AND status = 'captured'
    `);
    const [pendingDocs] = await this.dataSource.query(`
      SELECT count(*)::int AS count FROM documents WHERE status = 'pending'
    `);
    const [activeDrivers] = await this.dataSource.query(`
      SELECT count(*)::int AS count FROM driver_profiles WHERE is_online = true
    `);
    const [openTickets] = await this.dataSource.query(`
      SELECT count(*)::int AS count FROM tickets WHERE status IN ('open', 'in_progress')
    `);
    const [safetyTickets] = await this.dataSource.query(`
      SELECT count(*)::int AS count FROM tickets WHERE category = 'safety' AND status IN ('open', 'in_progress')
    `);

    return {
      trips_today: tripsToday.count,
      gmv_today_pence: Number(gmvToday.pence),
      commission_today_pence: Number(commissionToday.pence),
      pending_documents: pendingDocs.count,
      active_drivers: activeDrivers.count,
      open_tickets: openTickets.count,
      open_safety_tickets: safetyTickets.count,
    };
  }

  /** Live Trip Monitoring (Section 8) — recent trips with enough context to triage from a list view. */
  async recentTrips(limit = 50) {
    return this.dataSource.query(
      `
      SELECT
        t.id AS trip_id,
        t.started_at,
        t.ended_at,
        t.sos_triggered,
        br.status AS booking_status,
        rider.full_name AS rider_name,
        driver.full_name AS driver_name,
        ro.origin_label,
        ro.destination_label
      FROM trips t
      JOIN booking_requests br ON br.id = t.booking_request_id
      JOIN route_offers ro ON ro.id = br.route_offer_id
      JOIN users rider ON rider.id = br.rider_id
      JOIN users driver ON driver.id = ro.driver_id
      ORDER BY t.created_at DESC
      LIMIT $1
      `,
      [limit],
    );
  }
}
