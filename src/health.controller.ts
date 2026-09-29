import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * GET /health — quick "is it deployed correctly?" check for cPanel.
 * Returns 200 with db:"up" when the database is reachable, 503 otherwise.
 */
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  @Get()
  async check() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', db: 'up' };
    } catch {
      throw new ServiceUnavailableException({ status: 'degraded', db: 'down' });
    }
  }
}
