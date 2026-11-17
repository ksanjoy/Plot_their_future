import { Global, Inject, Module } from '@nestjs/common';
import { validateEnv, type Env } from './env.js';

export const ENV = Symbol('ENV');
export const InjectEnv = () => Inject(ENV);
export type { Env };

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => validateEnv(process.env) }],
  exports: [ENV],
})
export class AppConfigModule {}
