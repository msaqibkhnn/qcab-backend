import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RouteOffer } from './entities/route-offer.entity';

interface SearchParams {
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  departureWindowMinutes?: number;
}

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(RouteOffer) private routeOffers: Repository<RouteOffer>,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async create(driverId: string, body: {
    vehicleId: string;
    zoneId?: string;
    origin: { lat: number; lng: number; label: string };
    destination: { lat: number; lng: number; label: string };
    departureTime?: string;
    recurrenceRule?: string;
    seatsTotal: number;
    pricePence: number;
  }) {
    const result = await this.dataSource.query(
      `INSERT INTO route_offers
        (driver_id, vehicle_id, zone_id, origin_lat, origin_lng, origin_label,
         destination_lat, destination_lng, destination_label, departure_time,
         recurrence_rule, seats_total, seats_available, price_pence)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12, $13)
       RETURNING id`,
      [
        driverId,
        body.vehicleId,
        body.zoneId ?? null,
        body.origin.lat, body.origin.lng, body.origin.label,
        body.destination.lat, body.destination.lng, body.destination.label,
        body.departureTime ?? null,
        body.recurrenceRule ?? null,
        body.seatsTotal,
        body.pricePence,
      ],
    );
    return { id: result[0].id };
  }

  /**
   * Core matching query (Section 10.2 of the spec): candidate routes
   * whose origin AND destination both fall within the zone's configured
   * matching radius of the rider's requested points, ranked by combined
   * distance. Zone radius defaults to 3 miles when a route has no zone.
   *
   * cPanel build: distances use the haversine formula in plain SQL
   * (no PostGIS). The inner query computes each distance once; the
   * outer query filters/sorts on the computed columns.
   * $1=originLat $2=originLng $3=destLat $4=destLng $5=window(min)
   */
  async search(params: SearchParams) {
    const windowMinutes = params.departureWindowMinutes ?? 30;

    return this.dataSource.query(
      `
      SELECT id, price_pence, seats_available, departure_time, origin_label,
             destination_label, driver_name, driver_rating, vehicle_label,
             origin_distance_m, destination_distance_m
      FROM (
        SELECT
          ro.id,
          ro.price_pence,
          ro.seats_available,
          ro.departure_time,
          ro.origin_label,
          ro.destination_label,
          u.full_name AS driver_name,
          dp.average_rating AS driver_rating,
          v.make || ' ' || v.model AS vehicle_label,
          COALESCE(z.matching_radius_miles, 3.0) * 1609.34 AS radius_m,
          6371000 * 2 * asin(sqrt(least(1.0,
            power(sin(radians(ro.origin_lat - $1::float8) / 2), 2)
            + cos(radians($1::float8)) * cos(radians(ro.origin_lat))
              * power(sin(radians(ro.origin_lng - $2::float8) / 2), 2)))) AS origin_distance_m,
          6371000 * 2 * asin(sqrt(least(1.0,
            power(sin(radians(ro.destination_lat - $3::float8) / 2), 2)
            + cos(radians($3::float8)) * cos(radians(ro.destination_lat))
              * power(sin(radians(ro.destination_lng - $4::float8) / 2), 2)))) AS destination_distance_m
        FROM route_offers ro
        JOIN users u ON u.id = ro.driver_id
        JOIN driver_profiles dp ON dp.user_id = ro.driver_id
        JOIN vehicles v ON v.id = ro.vehicle_id
        LEFT JOIN zones z ON z.id = ro.zone_id
        WHERE ro.is_active = true
          AND ro.seats_available > 0
          AND (ro.departure_time IS NULL
               OR ro.departure_time BETWEEN now() - ($5 || ' minutes')::interval
                                        AND now() + ($5 || ' minutes')::interval)
      ) candidates
      WHERE origin_distance_m <= radius_m
        AND destination_distance_m <= radius_m
      ORDER BY (origin_distance_m + destination_distance_m) ASC
      LIMIT 25
      `,
      [params.originLat, params.originLng, params.destinationLat, params.destinationLng, String(windowMinutes)],
    );
  }

  findOne(id: string) {
    return this.routeOffers.findOne({ where: { id } });
  }
}
