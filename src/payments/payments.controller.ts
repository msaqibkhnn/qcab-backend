import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { StripeConnectService } from './stripe-connect.service';
import { PaymentsService } from './payments.service';

@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    private stripeConnect: StripeConnectService,
    private payments: PaymentsService,
  ) {}

  @Post('charge')
  async charge(@Body('trip_id') tripId: string) {
    return this.payments.chargeForTrip(tripId);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('drivers/stripe')
export class DriverStripeController {
  constructor(private stripeConnect: StripeConnectService) {}

  @Post('onboarding-link')
  onboardingLink(@CurrentUser() user: { userId: string }) {
    return this.stripeConnect.createOnboardingLink(user.userId);
  }
}
