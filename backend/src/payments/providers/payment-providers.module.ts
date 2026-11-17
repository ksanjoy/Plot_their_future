import { Module } from '@nestjs/common';
import { ENV, type Env } from '../../config/config.module.js';
import { MockPaymentProvider } from './mock.provider.js';
import { PAYMENT_PROVIDER } from './payment-provider.js';
import { RazorpayProvider } from './razorpay.provider.js';

@Module({
  providers: [
    {
      provide: PAYMENT_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) => (env.PAYMENT_PROVIDER === 'razorpay' ? new RazorpayProvider(env) : new MockPaymentProvider()),
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentProvidersModule {}
