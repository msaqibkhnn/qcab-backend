import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoutesService } from './routes.service';

@Controller('routes')
export class RoutesController {
  constructor(private routes: RoutesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: { userId: string }, @Body() body: any) {
    return this.routes.create(user.userId, body);
  }

  @Get('search')
  search(
    @Query('origin_lat') originLat: string,
    @Query('origin_lng') originLng: string,
    @Query('destination_lat') destinationLat: string,
    @Query('destination_lng') destinationLng: string,
    @Query('departure_window_minutes') windowMinutes?: string,
  ) {
    return this.routes.search({
      originLat: parseFloat(originLat),
      originLng: parseFloat(originLng),
      destinationLat: parseFloat(destinationLat),
      destinationLng: parseFloat(destinationLng),
      departureWindowMinutes: windowMinutes ? parseInt(windowMinutes, 10) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.routes.findOne(id);
  }
}
