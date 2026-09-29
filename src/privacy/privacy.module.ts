import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrivacyRequest } from './entities/privacy-request.entity';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';

@Module({
  imports: [TypeOrmModule.forFeature([PrivacyRequest])],
  controllers: [PrivacyController],
  providers: [PrivacyService],
})
export class PrivacyModule {}
