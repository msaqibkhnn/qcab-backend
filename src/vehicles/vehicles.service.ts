import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './entities/vehicle.entity';

@Injectable()
export class VehiclesService {
  constructor(@InjectRepository(Vehicle) private vehicles: Repository<Vehicle>) {}

  register(driverId: string, body: { registrationNo: string; make: string; model: string; colour?: string; seatsAvailable?: number }) {
    const vehicle = this.vehicles.create({ driverId, ...body });
    return this.vehicles.save(vehicle);
  }

  findMine(driverId: string) {
    return this.vehicles.find({ where: { driverId, isActive: true } });
  }
}
