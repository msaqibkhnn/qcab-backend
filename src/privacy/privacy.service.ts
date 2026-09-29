import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrivacyRequest, PrivacyRequestType } from './entities/privacy-request.entity';

@Injectable()
export class PrivacyService {
  constructor(@InjectRepository(PrivacyRequest) private requests: Repository<PrivacyRequest>) {}

  create(userId: string, type: PrivacyRequestType) {
    const due = new Date();
    due.setMonth(due.getMonth() + 1); // UK GDPR: one calendar month from receipt
    const request = this.requests.create({
      userId,
      requestType: type,
      statutoryDueDate: due.toISOString().slice(0, 10),
    });
    // NOTE: this only logs the request with its statutory deadline —
    // it does not itself execute an export or erasure. That requires a
    // cross-service job (pull every table referencing user_id, or scrub
    // it per the retention policy) which belongs in the CRM's GDPR
    // module (Section 9), not inline in this endpoint.
    return this.requests.save(request);
  }
}
