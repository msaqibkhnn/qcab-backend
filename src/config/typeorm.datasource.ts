import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';

config();

/**
 * Connects to the schema created by qcab_schema.sql — TypeORM is
 * configured with synchronize:false everywhere in this project. The SQL
 * file is the source of truth for the schema; entities below are typed
 * mappings onto it, not a code-first schema generator.
 *
 * cPanel notes:
 *  - installExtensions:false stops TypeORM trying to CREATE EXTENSION on
 *    startup (cPanel DB users are not superusers; the schema needs none).
 *  - DATABASE_SSL=true enables TLS for remote/managed Postgres. Set
 *    DATABASE_SSL_REJECT_UNAUTHORIZED=false only if your provider uses a
 *    self-signed certificate.
 */
const useSsl = (process.env.DATABASE_SSL ?? '').toLowerCase() === 'true';

export const typeOrmConfig: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false,
  installExtensions: false,
  ssl: useSsl
    ? { rejectUnauthorized: (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED ?? 'true').toLowerCase() !== 'false' }
    : false,
  extra: { max: Number(process.env.DATABASE_POOL_MAX ?? 5) }, // shared hosts cap connections; keep this small
  logging: process.env.NODE_ENV === 'development',
};

export default new DataSource(typeOrmConfig);
