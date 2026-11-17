import { z } from 'zod';

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const csv = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

const secret = z.string().min(32, 'must be at least 32 characters');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(5000),
    API_PUBLIC_URL: z.url().default('http://localhost:5000'),
    WEB_PUBLIC_URL: z.url().default('http://localhost:3000'),
    CORS_ORIGINS: csv,
    TRUST_PROXY: bool.default(false),

    MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//, 'must be a MongoDB connection string'),
    REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

    JWT_SECRET: z.string().min(1),
    JWT_ACCESS_SECRET: secret,
    JWT_LINK_SECRET: secret,
    OTP_PEPPER: secret,
    JWT_ACCESS_TTL_SEC: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    OTP_TTL_SEC: z.coerce.number().int().positive().default(300),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    PLATFORM_ADMIN_PHONES: csv,
    DEFAULT_PHONE_COUNTRY: z.string().length(2).default('IN'),

    WHATSAPP_DRIVER: z.enum(['console', 'cloud']).default('console'),
    WHATSAPP_PHONE_NUMBER_ID: z.string().default(''),
    WHATSAPP_ACCESS_TOKEN: z.string().default(''),
    WHATSAPP_API_VERSION: z.string().default('v21.0'),
    WHATSAPP_TEMPLATE_LANGUAGE: z.string().default('en'),
    WHATSAPP_TEMPLATE_OTP: z.string().default('ptf_otp'),
    WHATSAPP_TEMPLATE_INVITE: z.string().default('ptf_invite'),
    WHATSAPP_TEMPLATE_RSVP: z.string().default('ptf_rsvp_confirmation'),
    WHATSAPP_TEMPLATE_RECEIPT: z.string().default('ptf_gift_receipt'),
    WHATSAPP_TEMPLATE_REMINDER: z.string().default('ptf_ceremony_reminder'),
    SMS_DRIVER: z.enum(['console', 'msg91']).default('console'),
    MSG91_AUTH_KEY: z.string().default(''),
    MSG91_OTP_TEMPLATE_ID: z.string().default(''),
    EXPOSE_DEV_OTP: bool.default(false),

    PAYMENT_PROVIDER: z.enum(['mock', 'razorpay']).default('mock'),
    RAZORPAY_KEY_ID: z.string().default(''),
    RAZORPAY_KEY_SECRET: z.string().default(''),
    RAZORPAY_WEBHOOK_SECRET: z.string().default(''),

    RECEIPT_SIGNING_SECRET: secret,
    RECEIPT_ISSUER_NAME: z.string().default('PlotTheirFuture.in'),

    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('./uploads'),
    S3_BUCKET: z.string().default(''),
    S3_REGION: z.string().default('ap-south-1'),
    S3_ENDPOINT: z.string().default(''),
    S3_ACCESS_KEY_ID: z.string().default(''),
    S3_SECRET_ACCESS_KEY: z.string().default(''),
    S3_PUBLIC_URL: z.string().default(''),
    MAX_UPLOAD_MB: z.coerce.number().positive().default(8),

    RUN_WORKERS: bool.default(true),
  })
  .superRefine((env, ctx) => {
    const require = (key: keyof typeof env, when: string) => {
      if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: `is required when ${when}` });
    };
    if (env.WHATSAPP_DRIVER === 'cloud') {
      require('WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_DRIVER=cloud');
      require('WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_DRIVER=cloud');
    }
    if (env.SMS_DRIVER === 'msg91') {
      require('MSG91_AUTH_KEY', 'SMS_DRIVER=msg91');
      require('MSG91_OTP_TEMPLATE_ID', 'SMS_DRIVER=msg91');
    }
    if (env.PAYMENT_PROVIDER === 'razorpay') {
      require('RAZORPAY_KEY_ID', 'PAYMENT_PROVIDER=razorpay');
      require('RAZORPAY_KEY_SECRET', 'PAYMENT_PROVIDER=razorpay');
      require('RAZORPAY_WEBHOOK_SECRET', 'PAYMENT_PROVIDER=razorpay');
    }
    if (env.STORAGE_DRIVER === 's3') {
      require('S3_BUCKET', 'STORAGE_DRIVER=s3');
      require('S3_PUBLIC_URL', 'STORAGE_DRIVER=s3');
    }
    if (env.NODE_ENV === 'production' && env.PAYMENT_PROVIDER === 'mock') {
      ctx.addIssue({ code: 'custom', path: ['PAYMENT_PROVIDER'], message: 'mock payments are not allowed in production' });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return parsed.data;
}
