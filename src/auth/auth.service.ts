import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/entities/user.entity';
import { DriverProfile } from '../users/entities/driver-profile.entity';
import { RegisterDto } from './dto/register.dto';
import { OtpService } from './otp.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(DriverProfile) private driverProfiles: Repository<DriverProfile>,
    private otp: OtpService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<{ status: string }> {
    let user = await this.users.findOne({ where: { phoneNumber: dto.phone_number } });
    if (!user) {
      user = this.users.create({
        phoneNumber: dto.phone_number,
        role: dto.role,
        fullName: dto.full_name ?? '',
        email: dto.email,
        status: 'pending_verification',
      });
      user = await this.users.save(user);
      if (dto.role === 'driver') {
        await this.driverProfiles.save(this.driverProfiles.create({ userId: user.id }));
      }
    }
    await this.otp.sendCode(dto.phone_number);
    return { status: 'otp_sent' };
  }

  async verifyOtp(phoneNumber: string, code: string) {
    const ok = await this.otp.checkCode(phoneNumber, code);
    if (!ok) throw new UnauthorizedException('Invalid or expired code');

    const user = await this.users.findOne({ where: { phoneNumber } });
    if (!user) throw new NotFoundException('No account for this number — call /auth/register first');

    if (!user.phoneVerifiedAt) {
      user.phoneVerifiedAt = new Date();
      user.status = 'active';
      await this.users.save(user);
    }

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; role: string };
    try {
      payload = this.jwt.verify(refreshToken, { secret: this.config.get('JWT_REFRESH_SECRET') });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException();
    return this.issueTokens(user);
  }

  /**
   * Staff login (admin / support_agent / finance_admin / super_admin).
   * Separate from the rider/driver OTP flow deliberately: staff accounts
   * are provisioned internally (see scripts/seed-admin.ts), not
   * self-registered, and authenticate with email+password rather than a
   * phone number — there's no reason an ops team needs SMS OTP to log
   * into a desk-based admin console.
   */
  async staffLogin(email: string, password: string) {
    const user = await this.users.findOne({ where: { email } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');
    if (!['admin', 'support_agent', 'finance_admin', 'super_admin'].includes(user.role)) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    if (user.status !== 'active') throw new UnauthorizedException('Account is not active');
    return this.issueTokens(user);
  }

  private issueTokens(user: User) {
    const payload = { sub: user.id, role: user.role };
    return {
      access_token: this.jwt.sign(payload, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_TTL'),
      }),
      refresh_token: this.jwt.sign(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_TTL'),
      }),
      user: { id: user.id, role: user.role, fullName: user.fullName },
    };
  }
}
