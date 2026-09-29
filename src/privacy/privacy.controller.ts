import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrivacyService } from './privacy.service';

@UseGuards(JwtAuthGuard)
@Controller('privacy')
export class PrivacyController {
  constructor(private privacy: PrivacyService) {}

  @Post('export-request')
  export(@CurrentUser() user: { userId: string }) {
    return this.privacy.create(user.userId, 'export');
  }

  @Post('erasure-request')
  erasure(@CurrentUser() user: { userId: string }) {
    return this.privacy.create(user.userId, 'erasure');
  }
}
