import { Module } from '@nestjs/common';
import { ApprovalsService } from './approvals.service.js';
import { ContentService } from './content.service.js';
import { DirectoryService } from './directory.service.js';
import { FlatsService } from './flats.service.js';
import { PlatformController } from './platform.controller.js';

@Module({
  controllers: [PlatformController],
  providers: [FlatsService, ApprovalsService, ContentService, DirectoryService],
  exports: [ContentService],
})
export class PlatformModule {}
