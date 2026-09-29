import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SupportService } from './support.service';
import { TicketCategory } from './entities/ticket.entity';

@UseGuards(JwtAuthGuard)
@Controller()
export class SupportController {
  constructor(private support: SupportService) {}

  @Post('tickets')
  create(@CurrentUser() user: { userId: string }, @Body() body: { category: TicketCategory; related_trip_id?: string }) {
    return this.support.create(user.userId, body.category, body.related_trip_id);
  }

  @Get('tickets/:id')
  findOne(@Param('id') id: string) {
    return this.support.findOne(id);
  }

  @Post('tickets/:id/messages')
  addMessage(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body('body') body: string) {
    return this.support.addMessage(id, user.userId, body);
  }

  @Post('disputes')
  createDispute(@Body() body: { ticket_id: string; trip_id?: string }) {
    return this.support.createDispute(body.ticket_id, body.trip_id);
  }
}
