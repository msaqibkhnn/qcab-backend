import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { StaffLoginDto } from './dto/staff-login.dto';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('otp/verify')
  verify(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.phone_number, dto.code);
  }

  @Post('refresh')
  refresh(@Body('refresh_token') refreshToken: string) {
    return this.auth.refresh(refreshToken);
  }

  @Post('staff/login')
  staffLogin(@Body() dto: StaffLoginDto) {
    return this.auth.staffLogin(dto.email, dto.password);
  }
}
