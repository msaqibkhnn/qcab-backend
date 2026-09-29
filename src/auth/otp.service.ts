import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

/**
 * Wraps Twilio Verify so OTP codes are never generated or stored by
 * QCab itself — Twilio issues, sends and checks the code, we just relay
 * the phone number and the code the user typed.
 *
 * DEV BYPASS: when OTP_DEV_BYPASS=true, this skips Twilio entirely and
 * uses a fixed code, logging it instead of sending an SMS. This is for
 * local development and CI only — it must never be set in a deployed
 * environment, since it would let anyone log in as anyone with a known
 * code. Consider gating this further (e.g. also require NODE_ENV
 * !== 'production') before this goes near a shared environment.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly devBypass: boolean;
  private client?: Twilio;
  private verifyServiceSid?: string;

  constructor(private config: ConfigService) {
    this.devBypass = this.config.get<string>('OTP_DEV_BYPASS') === 'true';
    // Safety net: with the bypass on, code 000000 logs in as ANY phone
    // number. Refuse to start like that in production unless someone
    // deliberately opts in (e.g. a private staging box on NODE_ENV=production).
    if (
      this.devBypass &&
      this.config.get<string>('NODE_ENV') === 'production' &&
      this.config.get<string>('ALLOW_OTP_DEV_BYPASS_IN_PRODUCTION') !== 'true'
    ) {
      throw new Error(
        'OTP_DEV_BYPASS=true is not allowed when NODE_ENV=production (anyone could log in as anyone). ' +
          'Set OTP_DEV_BYPASS=false and configure Twilio, or set ALLOW_OTP_DEV_BYPASS_IN_PRODUCTION=true if you truly intend this.',
      );
    }
    if (!this.devBypass) {
      this.client = new Twilio(
        this.config.getOrThrow<string>('TWILIO_ACCOUNT_SID'),
        this.config.getOrThrow<string>('TWILIO_AUTH_TOKEN'),
      );
      this.verifyServiceSid = this.config.getOrThrow<string>('TWILIO_VERIFY_SERVICE_SID');
    }
  }

  async sendCode(phoneNumber: string): Promise<void> {
    if (this.devBypass) {
      this.logger.warn(`OTP_DEV_BYPASS active — use code 000000 to verify ${phoneNumber}`);
      return;
    }
    await this.client!.verify.v2
      .services(this.verifyServiceSid!)
      .verifications.create({ to: phoneNumber, channel: 'sms' });
  }

  async checkCode(phoneNumber: string, code: string): Promise<boolean> {
    if (this.devBypass) {
      return code === '000000';
    }
    const check = await this.client!.verify.v2
      .services(this.verifyServiceSid!)
      .verificationChecks.create({ to: phoneNumber, code });
    return check.status === 'approved';
  }
}
