import { validateEnv } from './env.js';

const base = {
  DATABASE_URL: 'postgresql://ptf:ptf@localhost:5432/ptf',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_LINK_SECRET: 'b'.repeat(32),
  OTP_PEPPER: 'c'.repeat(32),
  RECEIPT_SIGNING_SECRET: 'd'.repeat(32),
};

describe('validateEnv', () => {
  it('applies development defaults', () => {
    const env = validateEnv(base);
    expect(env.PORT).toBe(4000);
    expect(env.PAYMENT_PROVIDER).toBe('mock');
    expect(env.WHATSAPP_DRIVER).toBe('console');
  });

  it('parses comma separated lists', () => {
    const env = validateEnv({ ...base, CORS_ORIGINS: 'https://a.in, https://b.in', PLATFORM_ADMIN_PHONES: '+919000000099' });
    expect(env.CORS_ORIGINS).toEqual(['https://a.in', 'https://b.in']);
    expect(env.PLATFORM_ADMIN_PHONES).toEqual(['+919000000099']);
  });

  it('rejects short secrets', () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'short' })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('refuses the mock payment provider in production', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(/PAYMENT_PROVIDER/);
  });

  it('requires Razorpay credentials when Razorpay is selected', () => {
    expect(() => validateEnv({ ...base, PAYMENT_PROVIDER: 'razorpay' })).toThrow(/RAZORPAY/);
    expect(
      validateEnv({ ...base, PAYMENT_PROVIDER: 'razorpay', RAZORPAY_KEY_ID: 'rzp_test_x', RAZORPAY_KEY_SECRET: 's', RAZORPAY_WEBHOOK_SECRET: 'w' })
        .PAYMENT_PROVIDER,
    ).toBe('razorpay');
  });

  it('requires Meta credentials for the cloud WhatsApp driver', () => {
    expect(() => validateEnv({ ...base, WHATSAPP_DRIVER: 'cloud' })).toThrow(/WHATSAPP/);
  });
});
