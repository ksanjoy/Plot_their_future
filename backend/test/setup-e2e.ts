import { MongoMemoryReplSet } from 'mongodb-memory-server';

// Runs before the e2e suites import the app. Values here win over .env.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-jwt-secret';
process.env.JWT_ACCESS_SECRET ??= 'ci-access-secret-ci-access-secret-ci-access';
process.env.JWT_LINK_SECRET ??= 'ci-link-secret-ci-link-secret-ci-link-secret00';
process.env.OTP_PEPPER ??= 'ci-otp-pepper-ci-otp-pepper-ci-otp-pepper-0000';
process.env.RECEIPT_SIGNING_SECRET ??= 'ci-receipt-secret-ci-receipt-secret-ci-000';
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/15';
process.env.PAYMENT_PROVIDER = 'mock';
process.env.WHATSAPP_DRIVER = 'console';
process.env.SMS_DRIVER = 'console';
process.env.STORAGE_DRIVER = 'local';
process.env.STORAGE_LOCAL_DIR = './uploads-test';
process.env.EXPOSE_DEV_OTP = '1';
process.env.RUN_WORKERS = '1';
process.env.PLATFORM_ADMIN_PHONES = '+919000000099';
process.env.WEB_PUBLIC_URL = 'http://localhost:3000';
process.env.API_PUBLIC_URL = 'http://localhost:5000';

const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: 'wiredTiger' },
});
process.env.MONGODB_URI = replSet.getUri();
(globalThis as { __mongo?: MongoMemoryReplSet }).__mongo = replSet;

await import('../src/load-env.js');
