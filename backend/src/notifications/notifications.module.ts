import { Global, Module } from '@nestjs/common';
import { FollowupsService } from './followups.service.js';
import { InboxController } from './inbox.controller.js';
import { NotificationsService } from './notifications.service.js';
import { SmsService } from './sms.service.js';
import { WhatsAppService } from './whatsapp.service.js';

@Global()
@Module({
  controllers: [InboxController],
  providers: [WhatsAppService, SmsService, NotificationsService, FollowupsService],
  exports: [NotificationsService, FollowupsService],
})
export class NotificationsModule {}
