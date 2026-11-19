import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { objectId } from '../common/id.js';
import { CurrentUser, type AuthUser } from '../common/auth.js';
import { DeviceTokenModel, InAppNotificationModel } from '../models/schemas.js';

const deviceSchema = z.object({
  token: z.string().trim().min(8).max(4096),
  platform: z.enum(['ios', 'android', 'web']),
});

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class InboxController {
  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const rows = await InAppNotificationModel.find({ userId: user.id }).sort({ createdAt: -1 }).limit(100);
    const unread = rows.filter((row) => !row.readAt).length;
    return {
      unread,
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        kind: row.kind,
        readAt: row.readAt,
        createdAt: row.createdAt,
      })),
    };
  }

  @Post('devices')
  @HttpCode(200)
  async registerDevice(@CurrentUser() user: AuthUser, @Body({ schema: deviceSchema }) body: z.infer<typeof deviceSchema>) {
    await DeviceTokenModel.findOneAndUpdate(
      { token: body.token },
      { $set: { userId: user.id, platform: body.platform }, $setOnInsert: { token: body.token } },
      { upsert: true },
    );
    return { ok: true };
  }

  @Post('read')
  @HttpCode(204)
  async readAll(@CurrentUser() user: AuthUser) {
    await InAppNotificationModel.updateMany({ userId: user.id, readAt: null }, { $set: { readAt: new Date() } });
  }

  @Post(':id/read')
  @HttpCode(204)
  async readOne(@CurrentUser() user: AuthUser, @Param('id', { schema: objectId }) id: string) {
    await InAppNotificationModel.updateOne({ _id: id, userId: user.id }, { $set: { readAt: new Date() } });
  }
}
