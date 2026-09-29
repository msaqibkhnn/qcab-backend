import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { VehiclesService } from './vehicles.service';

@UseGuards(JwtAuthGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private vehicles: VehiclesService) {}

  @Post()
  register(@CurrentUser() user: { userId: string }, @Body() body: any) {
    return this.vehicles.register(user.userId, body);
  }

  @Get('mine')
  mine(@CurrentUser() user: { userId: string }) {
    return this.vehicles.findMine(user.userId);
  }
}
