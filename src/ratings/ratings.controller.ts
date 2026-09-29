import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RatingsService } from './ratings.service';

@Controller()
export class RatingsController {
  constructor(private ratings: RatingsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('trips/:id/rating')
  submit(
    @CurrentUser() user: { userId: string },
    @Param('id') tripId: string,
    @Body() body: { stars: number; tags?: string[]; comment?: string },
  ) {
    return this.ratings.submit(tripId, user.userId, body.stars, body.tags, body.comment);
  }

  @Get('users/:id/ratings')
  forUser(@Param('id') id: string) {
    return this.ratings.forUser(id);
  }
}
