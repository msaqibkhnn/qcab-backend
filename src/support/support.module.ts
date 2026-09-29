import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket, TicketMessage, Dispute } from './entities/ticket.entity';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, TicketMessage, Dispute])],
  controllers: [SupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
