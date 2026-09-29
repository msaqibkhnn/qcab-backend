import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketCategory, TicketMessage, Dispute, TicketStatus } from './entities/ticket.entity';

// SLA windows by category (Section 9 of the spec) — safety-critical
// tickets get the tightest response target.
const SLA_HOURS: Record<TicketCategory, number> = {
  safety: 1,
  fare_dispute: 24,
  account: 24,
  technical: 48,
  gdpr_request: 720, // statutory one calendar month, handled precisely in privacy.service.ts instead
  other: 48,
};

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(Ticket) private tickets: Repository<Ticket>,
    @InjectRepository(TicketMessage) private messages: Repository<TicketMessage>,
    @InjectRepository(Dispute) private disputes: Repository<Dispute>,
  ) {}

  create(requesterId: string, category: TicketCategory, relatedTripId?: string) {
    const slaDueAt = new Date(Date.now() + SLA_HOURS[category] * 60 * 60 * 1000);
    const ticket = this.tickets.create({ requesterId, category, relatedTripId, slaDueAt, status: 'open' });
    return this.tickets.save(ticket);
  }

  /** Powers the CRM's unified ticket inbox (Section 9) — newest first, optionally filtered by status. */
  findAll(status?: TicketStatus) {
    return this.tickets.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async findOne(id: string) {
    const ticket = await this.tickets.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const thread = await this.messages.find({ where: { ticketId: id }, order: { createdAt: 'ASC' } });
    return { ticket, thread };
  }

  addMessage(ticketId: string, senderId: string, body: string) {
    return this.messages.save(this.messages.create({ ticketId, senderId, body }));
  }

  async createDispute(ticketId: string, tripId?: string) {
    return this.disputes.save(this.disputes.create({ ticketId, tripId }));
  }

  async resolveDispute(disputeId: string, decision: string, refundAmountPence: number, approvedBy: string) {
    const dispute = await this.disputes.findOne({ where: { id: disputeId } });
    if (!dispute) throw new NotFoundException('Dispute not found');
    dispute.decision = decision as any;
    dispute.refundAmountPence = refundAmountPence;
    dispute.approvedBy = approvedBy;
    await this.disputes.save(dispute);
    await this.tickets.update(dispute.ticketId, { status: 'resolved', resolvedAt: new Date() });
    return dispute;
  }
}
