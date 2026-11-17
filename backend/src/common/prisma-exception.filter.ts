import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const map: Record<string, [number, string]> = {
      P2002: [HttpStatus.CONFLICT, 'A record with these unique values already exists'],
      P2003: [HttpStatus.CONFLICT, 'The record is referenced by other data'],
      P2025: [HttpStatus.NOT_FOUND, 'Record not found'],
    };
    const [status, message] = map[error.code] ?? [HttpStatus.INTERNAL_SERVER_ERROR, 'Database error'];
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) this.logger.error(error.message, error.stack);
    res.status(status).json({ statusCode: status, message, code: error.code });
  }
}
