import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: { userId: string }) {
    return this.notifications.list(user.userId);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.notifications.markRead(id);
  }
}
