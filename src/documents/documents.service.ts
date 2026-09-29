import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentEntity, DocumentType } from './entities/document.entity';
import { DriverProfile } from '../users/entities/driver-profile.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(DocumentEntity) private documents: Repository<DocumentEntity>,
    @InjectRepository(DriverProfile) private driverProfiles: Repository<DriverProfile>,
    @InjectRepository(Vehicle) private vehicles: Repository<Vehicle>,
  ) {}

  upload(body: { ownerUserId?: string; ownerVehicleId?: string; docType: DocumentType; fileUrl: string; expiryDate?: string }) {
    const doc = this.documents.create({ ...body, status: 'pending' });
    return this.documents.save(doc);
  }

  async verificationStatus(driverId: string) {
    const profile = await this.driverProfiles.findOne({ where: { userId: driverId } });
    if (!profile) throw new NotFoundException('Driver profile not found');
    const docs = await this.documents.find({ where: { ownerUserId: driverId } });
    return {
      approval_status: profile.approvalStatus,
      dbs_status: profile.dbsStatus,
      is_online: profile.isOnline,
      documents: docs.map((d) => ({ type: d.docType, status: d.status, expiry_date: d.expiryDate, rejection_reason: d.rejectionReason })),
    };
  }

  async pendingQueue() {
    return this.documents.find({ where: { status: 'pending' }, order: { submittedAt: 'ASC' } });
  }

  async approve(id: string, reviewerId: string) {
    const doc = await this.documents.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    doc.status = 'approved';
    doc.reviewedBy = reviewerId;
    doc.reviewedAt = new Date();
    await this.documents.save(doc);
    await this.maybeApproveDriver(doc.ownerUserId);
    return doc;
  }

  async reject(id: string, reviewerId: string, reason: string) {
    const doc = await this.documents.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    doc.status = 'rejected';
    doc.reviewedBy = reviewerId;
    doc.reviewedAt = new Date();
    doc.rejectionReason = reason;
    return this.documents.save(doc);
  }

  /**
   * The actual "can't go online with an expired/missing document" gate
   * from Section 3.2 of the spec. Checked fresh on every attempt to go
   * online — not just at approval time — so a document that expires
   * after approval correctly blocks the driver again without requiring
   * a background job to notice first. Going offline is always allowed.
   *
   * FOLLOW-UP: this only blocks the *next* attempt to go online. An
   * already-online driver whose document expires mid-shift stays online
   * until they next toggle — a scheduled job that force-offlines drivers
   * with newly-expired documents (and notifies them) would close that
   * gap and belongs alongside the Notifications module.
   */
  async setOnlineStatus(driverId: string, wantOnline: boolean) {
    if (!wantOnline) {
      await this.driverProfiles.update({ userId: driverId }, { isOnline: false });
      return { is_online: false };
    }

    const profile = await this.driverProfiles.findOne({ where: { userId: driverId } });
    if (!profile) throw new NotFoundException('Driver profile not found');

    if (profile.approvalStatus !== 'approved') {
      throw new BadRequestException('Cannot go online until your documents are fully approved');
    }

    const today = new Date().toISOString().slice(0, 10);
    if (profile.dbsExpiryDate && this.dateOnly(profile.dbsExpiryDate) < today) {
      throw new BadRequestException('Your DBS check has expired — upload a renewed certificate before going online');
    }

    const vehicles = await this.vehicles.find({ where: { driverId, isActive: true } });
    if (vehicles.length === 0) {
      throw new BadRequestException('Register a vehicle before going online');
    }
    const expiredVehicle = vehicles.find(
      (v) =>
        (v.motExpiryDate && this.dateOnly(v.motExpiryDate) < today) ||
        (v.insuranceExpiryDate && this.dateOnly(v.insuranceExpiryDate) < today),
    );
    if (expiredVehicle) {
      throw new BadRequestException(
        `Vehicle ${expiredVehicle.registrationNo} has an expired MOT or insurance certificate — renew it before going online`,
      );
    }

    await this.driverProfiles.update({ userId: driverId }, { isOnline: true });
    return { is_online: true };
  }

  private dateOnly(d: Date | string): string {
    return typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10);
  }

  /**
   * A driver only reaches approval_status='approved' once every required
   * document type is individually approved. This is necessary but not
   * sufficient for going online — see setOnlineStatus() above for the
   * expiry checks applied on top of this at the actual go-online gate.
   *
   * SIMPLIFICATION: this scaffold checks vehicle documents (V5C, MOT,
   * insurance) by ownerUserId rather than ownerVehicleId, i.e. it
   * assumes the upload flow tags vehicle docs with the driver's user id
   * as well as the vehicle id. A multi-vehicle driver needs this
   * reworked to check per-vehicle document completeness instead.
   */
  private async maybeApproveDriver(driverId?: string) {
    if (!driverId) return;
    const required: DocumentType[] = ['driving_licence', 'dbs_check', 'vehicle_v5c', 'vehicle_mot', 'vehicle_insurance'];
    const docs = await this.documents.find({ where: { ownerUserId: driverId } });
    const allApproved = required.every((type) => docs.some((d) => d.docType === type && d.status === 'approved'));
    if (allApproved) {
      await this.driverProfiles.update({ userId: driverId }, { approvalStatus: 'approved', approvedAt: new Date() });
    }
  }
}
