// Runs before the e2e suites import the app. Values here win over .env.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://ptf:ptf@localhost:5432/ptf_test?schema=public';
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
process.env.API_PUBLIC_URL = 'http://localhost:4000';
await import('../src/load-env.js');
