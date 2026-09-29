import { BadRequestException, Controller, Headers, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StripeWebhookEvent } from './entities/payment.entity';
import { DriverProfile } from '../users/entities/driver-profile.entity';
import { StripeConnectService } from './stripe-connect.service';
import { PaymentsService } from './payments.service';

/**
 * NOTE: this route must receive the *raw* request body for Stripe's
 * signature check to pass. In main.ts we register a raw-body parser
 * scoped to exactly this path, before the global JSON body parser.
 */
@Controller('webhooks')
export class StripeWebhookController {
  constructor(
    private stripeConnect: StripeConnectService,
    private payments: PaymentsService,
    @InjectRepository(StripeWebhookEvent) private webhookEvents: Repository<StripeWebhookEvent>,
    @InjectRepository(DriverProfile) private driverProfiles: Repository<DriverProfile>,
  ) {}

  @Post('stripe')
  async handle(@Req() req: Request, @Headers('stripe-signature') signature: string) {
    let event;
    try {
      event = this.stripeConnect.constructEvent(req.body, signature);
    } catch (err) {
      throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
    }

    // Idempotency: Stripe retries delivery, so a duplicate event id
    // must be a no-op rather than double-applying the state change.
    const alreadyProcessed = await this.webhookEvents.findOne({ where: { stripeEventId: event.id } });
    if (alreadyProcessed) return { received: true, duplicate: true };
    await this.webhookEvents.save(this.webhookEvents.create({ stripeEventId: event.id, eventType: event.type }));

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.payments.markCaptured(event.data.object.id);
        break;

      case 'account.updated': {
        const account = event.data.object;
        const profile = await this.driverProfiles.findOne({ where: { stripeConnectAccountId: account.id } });
        if (profile) {
          profile.stripeOnboardingComplete = Boolean(account.charges_enabled && account.payouts_enabled);
          await this.driverProfiles.save(profile);
        }
        break;
      }

      default:
        break; // Unhandled event types are acknowledged, not errored — Stripe only needs a 2xx.
    }

    return { received: true };
  }
}
