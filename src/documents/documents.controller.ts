import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DocumentsService } from './documents.service';

@UseGuards(JwtAuthGuard)
@Controller('drivers')
export class DocumentsController {
  constructor(private documents: DocumentsService) {}

  // NOTE: in production this is multipart/form-data with a file upload
  // to object storage (S3 or similar); the controller receives the
  // resulting file_url after that upload, not the raw file itself.
  @Post('documents')
  upload(@CurrentUser() user: { userId: string }, @Body() body: any) {
    return this.documents.upload({ ownerUserId: user.userId, ...body });
  }

  @Get('verification-status')
  status(@CurrentUser() user: { userId: string }) {
    return this.documents.verificationStatus(user.userId);
  }

  @Post('online')
  setOnline(@CurrentUser() user: { userId: string }, @Body('online') online: boolean) {
    return this.documents.setOnlineStatus(user.userId, online);
  }
}
