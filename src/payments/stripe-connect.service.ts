import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DriverProfile } from '../users/entities/driver-profile.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class StripeConnectService {
  private readonly stripe: Stripe;

  constructor(
    private config: ConfigService,
    @InjectRepository(DriverProfile) private driverProfiles: Repository<DriverProfile>,
    @InjectRepository(User) private users: Repository<User>,
  ) {
    // STRIPE_API_HOST/PORT/PROTOCOL let this point at a local stripe-mock
    // instance for testing without touching Stripe's real servers —
    // unset in any real environment, where the Stripe SDK's own default
    // host applies.
    const mockHost = this.config.get<string>('STRIPE_API_HOST');
    this.stripe = new Stripe(this.config.getOrThrow<string>('STRIPE_SECRET_KEY'), {
      apiVersion: '2024-06-20',
      ...(mockHost
        ? {
            host: mockHost,
            port: this.config.get<number>('STRIPE_API_PORT'),
            protocol: (this.config.get<string>('STRIPE_API_PROTOCOL') as 'http' | 'https') ?? 'http',
          }
        : {}),
    });
  }

  /**
   * Creates (first call) or resumes (later calls) a Stripe Connect
   * Express account for a driver and returns a short-lived hosted
   * onboarding URL. QCab never collects bank details itself — see
   * Section 3.4 of the spec.
   */
  async createOnboardingLink(driverId: string): Promise<{ onboarding_url: string }> {
    let profile = await this.driverProfiles.findOne({ where: { userId: driverId } });
    if (!profile) throw new NotFoundException('Driver profile not found — complete registration first');
    const user = await this.users.findOne({ where: { id: driverId } });
    if (!user) throw new NotFoundException('User not found');

    let accountId = profile.stripeConnectAccountId;
    if (!accountId) {
      const account = await this.stripe.accounts.create({
        type: 'express',
        country: 'GB',
        email: user.email,
        capabilities: { transfers: { requested: true } },
        business_type: 'individual',
      });
      accountId = account.id;
      profile.stripeConnectAccountId = accountId;
      profile = await this.driverProfiles.save(profile);
    }

    const link = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: this.config.getOrThrow<string>('STRIPE_CONNECT_REFRESH_URL'),
      return_url: this.config.getOrThrow<string>('STRIPE_CONNECT_RETURN_URL'),
      type: 'account_onboarding',
    });

    return { onboarding_url: link.url };
  }

  /**
   * Creates a PaymentIntent for the rider's fare, using
   * transfer_data.destination + application_fee_amount so Stripe
   * splits QCab's commission out automatically at settlement — QCab
   * never has to move the driver's share itself.
   */
  async createPaymentIntent(params: {
    driverId: string;
    totalPence: number;
    commissionPence: number;
    riderStripeCustomerId?: string;
  }): Promise<{ client_secret: string; payment_intent_id: string }> {
    const profile = await this.driverProfiles.findOne({ where: { userId: params.driverId } });
    if (!profile?.stripeConnectAccountId || !profile.stripeOnboardingComplete) {
      throw new Error('Driver has not completed Stripe Connect onboarding');
    }

    const intent = await this.stripe.paymentIntents.create({
      amount: params.totalPence,
      currency: 'gbp',
      application_fee_amount: params.commissionPence,
      transfer_data: { destination: profile.stripeConnectAccountId },
      customer: params.riderStripeCustomerId,
      automatic_payment_methods: { enabled: true },
    });

    if (!intent.client_secret) throw new Error('Stripe did not return a client secret for this PaymentIntent');
    return { client_secret: intent.client_secret, payment_intent_id: intent.id };
  }

  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(rawBody, signature, this.config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET'));
  }
}
