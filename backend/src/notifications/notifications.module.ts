import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { SmsService } from './sms.service.js';
import { WhatsAppService } from './whatsapp.service.js';

@Global()
@Module({
  providers: [WhatsAppService, SmsService, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
