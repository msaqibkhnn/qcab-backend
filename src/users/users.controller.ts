import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: { userId: string }) {
    return this.users.findById(user.userId);
  }

  @Put('me')
  update(@CurrentUser() user: { userId: string }, @Body() body: any) {
    return this.users.update(user.userId, body);
  }
}
