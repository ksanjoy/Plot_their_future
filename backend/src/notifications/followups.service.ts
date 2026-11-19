import { Injectable, Logger } from '@nestjs/common';
import { InvitationModel, PlatformContentModel, UserModel, WeddingMemberModel, type InvitationDoc } from '../models/schemas.js';
import { idString } from '../database/helpers.js';
import { pickLocale, DEFAULT_DISCLAIMER } from '../platform/content.defaults.js';
import { NotificationsService } from './notifications.service.js';

/** Spec example: at most one promotional nudge every few days. */
const PROMO_GAP_MS = 3 * 24 * 60 * 60 * 1000;

@Injectable()
export class FollowupsService {
  private readonly logger = new Logger(FollowupsService.name);

  constructor(private readonly notifications: NotificationsService) {}

  async disclaimer(locale?: string | null) {
    const doc = await PlatformContentModel.findOne({ key: 'default' }).select('disclaimer');
    return pickLocale(doc?.disclaimer, locale ?? 'en') || pickLocale(DEFAULT_DISCLAIMER, locale ?? 'en');
  }

  /** After RSVP, one polite note about gifting a part of the home. */
  async afterRsvp(invitation: InvitationDoc, couple: string) {
    if (!(await this.reservePromo(invitation))) return;
    const user = await UserModel.findOne({ phone: invitation.phone }).select('locale messageOptOut');
    if (invitation.messageOptOut || user?.messageOptOut) return;
    const note = `Instead of regular gifts, consider gifting a part of ${couple}'s first home, such as a balcony or a few square feet.`;
    const body = `${note}\n\n${await this.disclaimer(user?.locale)}`;
    await this.notifications
      .sendNotice({
        phone: invitation.phone,
        userId: invitation.userId,
        template: 'ptf_gift_promo',
        title: `${couple}'s home registry`,
        body,
      })
      .catch((err: Error) => this.logger.warn(`Gift promo to ${invitation.id} failed: ${err.message}`));
  }

  async thankForGift(input: { phone: string | null; userId: string | null; donorName: string; couple: string }) {
    if (!input.phone) return;
    const user = input.userId ? await UserModel.findById(input.userId).select('locale messageOptOut') : null;
    const invite = await InvitationModel.findOne({ phone: input.phone }).select('messageOptOut');
    if (user?.messageOptOut || invite?.messageOptOut) return;
    const body = `Thank you ${input.donorName}. Your gift toward ${input.couple}'s first home is confirmed.\n\n${await this.disclaimer(user?.locale)}`;
    await this.notifications
      .sendNotice({
        phone: input.phone,
        userId: input.userId,
        template: 'ptf_gift_thanks',
        title: 'Thank you for your gift',
        body,
      })
      .catch((err: Error) => this.logger.warn(`Gift thanks failed: ${err.message}`));
  }

  /**
   * Reminder for guests who have not answered, or who are still tentative.
   * Returns how many messages were attempted.
   */
  async remindUndecided(weddingId: string, couple: string, link: string, phones: { id: string; phone: string; guestName: string; messageOptOut: boolean; userId: string | null; lastPromoAt: Date | null }[]) {
    let sent = 0;
    for (const guest of phones) {
      if (guest.messageOptOut) continue;
      if (guest.lastPromoAt && Date.now() - guest.lastPromoAt.getTime() < PROMO_GAP_MS) continue;
      const claimed = await InvitationModel.updateOne(
        {
          _id: guest.id,
          messageOptOut: { $ne: true },
          $or: [{ lastPromoAt: null }, { lastPromoAt: { $lt: new Date(Date.now() - PROMO_GAP_MS) } }],
        },
        { $set: { lastPromoAt: new Date() } },
      );
      if (!claimed.modifiedCount) continue;
      const body = `Namaste ${guest.guestName}, ${couple} are still hoping to hear if you can attend. ${link}\n\n${await this.disclaimer('en')}`;
      await this.notifications
        .sendNotice({
          phone: guest.phone,
          userId: guest.userId,
          template: 'ptf_rsvp_nudge',
          title: `A note from ${couple}`,
          body,
        })
        .catch((err: Error) => this.logger.warn(`Nudge to ${guest.id} failed: ${err.message}`));
      sent++;
    }
    return sent;
  }

  async notifyHostsOfGift(weddingId: string, summary: string) {
    const hosts = await WeddingMemberModel.find({ weddingId, role: { $in: ['HOST', 'CO_HOST'] } }).select('userId');
    for (const host of hosts) {
      const user = await UserModel.findById(host.userId).select('phone');
      if (!user) continue;
      await this.notifications
        .sendNotice({
          phone: user.phone,
          userId: idString(host.userId),
          template: 'ptf_gift_received',
          title: 'A new gift on your registry',
          body: summary,
        })
        .catch((err: Error) => this.logger.warn(`Host gift notice failed: ${err.message}`));
    }
  }

  private async reservePromo(invitation: InvitationDoc) {
    if (invitation.messageOptOut) return false;
    if (invitation.lastPromoAt && Date.now() - new Date(invitation.lastPromoAt).getTime() < PROMO_GAP_MS) return false;
    const claimed = await InvitationModel.updateOne(
      {
        _id: invitation._id,
        messageOptOut: { $ne: true },
        $or: [{ lastPromoAt: null }, { lastPromoAt: { $lt: new Date(Date.now() - PROMO_GAP_MS) } }],
      },
      { $set: { lastPromoAt: new Date() } },
    );
    return claimed.modifiedCount > 0;
  }
}
