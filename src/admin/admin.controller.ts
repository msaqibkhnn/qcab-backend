import { Body, Controller, Get, Param, Put, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DocumentsService } from '../documents/documents.service';
import { ZonesService } from '../zones/zones.service';
import { SupportService } from '../support/support.service';
import { AdminService } from './admin.service';
import { TicketStatus } from '../support/entities/ticket.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'super_admin', 'support_agent', 'finance_admin')
@Controller('admin')
export class AdminController {
  constructor(
    private documents: DocumentsService,
    private zones: ZonesService,
    private support: SupportService,
    private admin: AdminService,
  ) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('trips')
  trips() {
    return this.admin.recentTrips();
  }

  @Get('drivers/pending')
  pending() {
    return this.documents.pendingQueue();
  }

  @Post('drivers/:id/approve')
  approve(@CurrentUser() admin: { userId: string }, @Param('id') documentId: string) {
    // NOTE: {id} here is a document id, matching the Document
    // Verification Centre workflow (Section 8) where each document is
    // reviewed individually rather than the whole application at once.
    return this.documents.approve(documentId, admin.userId);
  }

  @Post('drivers/:id/reject')
  reject(@CurrentUser() admin: { userId: string }, @Param('id') documentId: string, @Body('reason') reason: string) {
    return this.documents.reject(documentId, admin.userId, reason);
  }

  @Get('zones')
  listZones() {
    return this.zones.findAllSummary();
  }

  @Put('zones/:id')
  updateZone(@Param('id') id: string, @Body() body: any) {
    return this.zones.update(id, body);
  }

  @Put('commission-config')
  updateCommission(@Body() body: { zone_id: string; commission_percent: number; bonus_tiers?: object }) {
    return this.zones.updateCommissionConfig(body.zone_id, body.commission_percent, body.bonus_tiers);
  }

  @Get('tickets')
  listTickets(@Query('status') status?: TicketStatus) {
    return this.support.findAll(status);
  }
}
