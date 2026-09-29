import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BookingsService } from './bookings.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class BookingsController {
  constructor(private bookings: BookingsService) {}

  @Post('bookings')
  create(@CurrentUser() user: { userId: string }, @Body() body: { route_offer_id: string; requested_price_pence: number }) {
    return this.bookings.create(user.userId, body.route_offer_id, body.requested_price_pence);
  }

  @Post('bookings/:id/accept')
  accept(@Param('id') id: string) {
    return this.bookings.accept(id);
  }

  @Post('bookings/:id/counter-offer')
  counterOffer(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() body: { proposed_price_pence: number },
  ) {
    return this.bookings.counterOffer(id, user.userId, body.proposed_price_pence);
  }

  @Post('bookings/:id/cancel')
  cancel(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() body: { reason?: string }) {
    return this.bookings.cancel(id, user.userId, body?.reason);
  }

  // NOTE: this scaffold uses the booking_request id as the path param for
  // /trips/{id}/* for simplicity, since a Trip row doesn't exist until
  // markInProgress() creates one. A production build should mint the
  // Trip id at booking confirmation time and use that consistently —
  // tracked as a follow-up in the backend README.
  @Post('trips/:id/start')
  start(@Param('id') id: string) {
    return this.bookings.startTrip(id);
  }

  @Post('trips/:id/arrived')
  arrived(@Param('id') id: string) {
    return this.bookings.markArrived(id);
  }

  @Post('trips/:id/in-progress')
  inProgress(@Param('id') id: string) {
    return this.bookings.markInProgress(id);
  }

  @Post('trips/:id/complete')
  complete(@Param('id') id: string) {
    return this.bookings.complete(id);
  }
}
