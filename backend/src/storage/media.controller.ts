import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/auth.js';
import { StorageService } from './storage.service.js';

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly storage: StorageService) {}

  @Public()
  @Get(':key')
  async get(@Param('key') key: string, @Res() res: Response) {
    const file = await this.storage.readLocal(key);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.body);
  }
}
