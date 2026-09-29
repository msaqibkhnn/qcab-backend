import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationChannel } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(@InjectRepository(Notification) private notifications: Repository<Notification>) {}

  list(userId: string) {
    return this.notifications.find({ where: { userId }, order: { sentAt: 'DESC' }, take: 50 });
  }

  markRead(id: string) {
    return this.notifications.update(id, { readAt: new Date() });
  }

  // Called by other services (booking confirmed, document rejected,
  // payout sent, etc.) rather than exposed as a public endpoint — actual
  // delivery over push/SMS/email is a separate follow-up integration
  // (FCM/APNs, Twilio, SendGrid) triggered from here.
  record(userId: string, channel: NotificationChannel, templateKey: string, payload: Record<string, unknown> = {}) {
    return this.notifications.save(this.notifications.create({ userId, channel, templateKey, payload }));
  }
}
