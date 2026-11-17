import { z } from 'zod';
import { SLUG_REGEX } from '../common/utils/format.js';

export const roomSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]{2,40}$/, 'lowercase letters, digits and _ only'),
  name: z.string().trim().min(1).max(60),
  sft: z.number().int().min(1).max(5000),
  description: z.string().trim().max(300).nullish(),
  icon: z.string().trim().max(40).nullish(),
});

export const roomsSchema = z
  .array(roomSchema)
  .min(1)
  .max(20)
  .refine((rooms) => new Set(rooms.map((r) => r.key)).size === rooms.length, 'room keys must be unique')
  .refine((rooms) => rooms.reduce((s, r) => s + r.sft, 0) <= 20_000, 'total area cannot exceed 20,000 SFT');

const optionalUrl = z.union([z.url(), z.literal('')]).nullish();

const weddingFields = {
  brideName: z.string().trim().min(1).max(50),
  groomName: z.string().trim().min(1).max(50),
  welcomeNote: z.string().trim().max(2000).nullish(),
  videoInviteUrl: optionalUrl,
  city: z.string().trim().max(80).nullish(),
  weddingDate: z.coerce.date().nullish(),
  timezone: z.string().max(64).optional(),
  propertyName: z.string().trim().max(120).nullish(),
  propertyLocation: z.string().trim().max(160).nullish(),
  ratePerSft: z.number().int().min(100).max(100_000),
  presetTiers: z.array(z.number().int().min(1).max(500)).min(1).max(6).optional(),
  cartHoldTtlSec: z.number().int().min(60).max(3600).optional(),
  reraRegId: z.string().trim().max(40).nullish(),
  escrowBankName: z.string().trim().max(80).nullish(),
  escrowAccountNumber: z.string().trim().regex(/^\d{6,20}$/, 'digits only').nullish(),
  escrowIfsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'invalid IFSC').nullish(),
  taxExemptionEnabled: z.boolean().optional(),
  stageDisplayMode: z.enum(['NAMES_AND_BLESSINGS', 'ANONYMIZED', 'PROGRESS_ONLY']).optional(),
};

export const createWeddingSchema = z.object({
  ...weddingFields,
  slug: z.string().regex(SLUG_REGEX).min(3).max(60).optional(),
  rooms: roomsSchema.optional(),
});

export const updateWeddingSchema = z.object(weddingFields).partial();

export const memberSchema = z.object({
  phone: z.string().min(6).max(20),
  name: z.string().trim().max(80).optional(),
  role: z.enum(['HOST', 'CO_HOST', 'LEAD', 'VENUE']),
  label: z
    .string()
    .trim()
    .regex(/^[a-z0-9_-]{2,30}$/i, 'letters, digits, - and _ only')
    .optional(),
});

export type CreateWeddingInput = z.infer<typeof createWeddingSchema>;
export type UpdateWeddingInput = z.infer<typeof updateWeddingSchema>;
export type MemberInput = z.infer<typeof memberSchema>;
