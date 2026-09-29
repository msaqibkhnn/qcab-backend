import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private users: Repository<User>) {}

  async findById(id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, patch: Partial<Pick<User, 'fullName' | 'email' | 'emergencyContactName' | 'emergencyContactPhone' | 'marketingConsent'>>) {
    await this.users.update(id, patch);
    return this.findById(id);
  }
}
