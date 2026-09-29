import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { User } from '../users/entities/user.entity';
import { DriverProfile } from '../users/entities/driver-profile.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, DriverProfile]),
    PassportModule,
    JwtModule.register({}), // secrets/expiry passed per-call in AuthService — supports the dual access/refresh secret setup
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
