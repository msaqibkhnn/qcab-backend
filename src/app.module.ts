import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './config/typeorm.datasource';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { DocumentsModule } from './documents/documents.module';
import { ZonesModule } from './zones/zones.module';
import { RoutesModule } from './routes/routes.module';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModule } from './payments/payments.module';
import { RatingsModule } from './ratings/ratings.module';
import { SupportModule } from './support/support.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrivacyModule } from './privacy/privacy.module';
import { AdminModule } from './admin/admin.module';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(typeOrmConfig),

    AuthModule,
    UsersModule,
    VehiclesModule,
    DocumentsModule,
    ZonesModule,
    RoutesModule,
    BookingsModule,
    PaymentsModule,
    RatingsModule,
    SupportModule,
    NotificationsModule,
    PrivacyModule,
    AdminModule,
  ],
})
export class AppModule {}
