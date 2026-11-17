import { BadRequestException, StandardSchemaValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import type { Env } from './config/config.module.js';

export const validationPipe = () =>
  new StandardSchemaValidationPipe({
    exceptionFactory: (issues) => {
      const errors = issues.map((issue) => ({
        path: issue.path?.map((s) => (typeof s === 'object' ? s.key : s)).join('.') ?? '',
        message: issue.message,
      }));
      const first = errors[0];
      return new BadRequestException({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: first ? (first.path ? `${first.path}: ${first.message}` : first.message) : 'Validation failed',
        errors,
      });
    },
  });

export const corsOrigins = (env: Env) => (env.CORS_ORIGINS.length ? env.CORS_ORIGINS : [env.WEB_PUBLIC_URL]);

/** HTTP pipeline shared by the server entrypoint and the e2e tests. */
export function configureApp(app: NestExpressApplication, env: Env) {
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(validationPipe());
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({ origin: corsOrigins(env), credentials: true, exposedHeaders: ['Content-Disposition'] });
  if (env.TRUST_PROXY) app.set('trust proxy', 1);
  app.enableShutdownHooks();
}
