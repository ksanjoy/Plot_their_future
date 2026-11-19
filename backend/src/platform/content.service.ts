import { Injectable } from '@nestjs/common';
import { AuditLogModel, PlatformContentModel, type PlatformContentDoc } from '../models/schemas.js';
import type { IntroScreen, LocalizedText } from '../models/types.js';
import { DEFAULT_DISCLAIMER, DEFAULT_INTRO, DEFAULT_PRIVACY, DEFAULT_TERMS, pickLocale } from './content.defaults.js';

export interface ContentPatch {
  disclaimer?: LocalizedText;
  intro?: IntroScreen[];
  supportPhone?: string | null;
  supportEmail?: string | null;
  terms?: LocalizedText;
  privacy?: LocalizedText;
  templates?: Record<string, LocalizedText>;
}

@Injectable()
export class ContentService {
  async ensure(): Promise<PlatformContentDoc> {
    const existing = await PlatformContentModel.findOne({ key: 'default' });
    if (existing) return existing;
    return PlatformContentModel.create({
      key: 'default',
      disclaimer: DEFAULT_DISCLAIMER,
      intro: DEFAULT_INTRO,
      terms: DEFAULT_TERMS,
      privacy: DEFAULT_PRIVACY,
      supportPhone: null,
      supportEmail: null,
      templates: {},
    });
  }

  async publicView(locale?: string) {
    const doc = await this.ensure();
    return {
      locale: locale === 'hi' || locale === 'te' ? locale : 'en',
      disclaimer: pickLocale(doc.disclaimer, locale),
      intro: (doc.intro ?? []).map((screen) => ({
        title: pickLocale(screen.title, locale),
        body: pickLocale(screen.body, locale),
      })),
      supportPhone: doc.supportPhone,
      supportEmail: doc.supportEmail,
      terms: pickLocale(doc.terms, locale),
      privacy: pickLocale(doc.privacy, locale),
    };
  }

  async adminView() {
    const doc = await this.ensure();
    return {
      disclaimer: doc.disclaimer,
      intro: doc.intro,
      supportPhone: doc.supportPhone,
      supportEmail: doc.supportEmail,
      terms: doc.terms,
      privacy: doc.privacy,
      templates: doc.templates ?? {},
      updatedAt: doc.updatedAt,
    };
  }

  async update(actorId: string, patch: ContentPatch) {
    await this.ensure();
    const set: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) set[key] = value;
    }
    const doc = await PlatformContentModel.findOneAndUpdate({ key: 'default' }, { $set: set }, { new: true });
    await AuditLogModel.create({ actorId, action: 'content.update', entityType: 'platform_content', entityId: 'default', meta: { fields: Object.keys(set) } });
    return doc;
  }
}
