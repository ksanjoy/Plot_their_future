import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { MongoServerError } from 'mongodb';
import { Error as MongooseError } from 'mongoose';

@Catch(MongoServerError, MongooseError.CastError, MongooseError.ValidationError)
export class MongoExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(MongoExceptionFilter.name);

  catch(error: MongoServerError | MongooseError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (error instanceof MongoServerError && error.code === 11000) {
      res.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message: 'A record with these unique values already exists',
        code: 'DUPLICATE_KEY',
      });
      return;
    }
    if (error instanceof MongooseError.CastError) {
      res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid id',
        code: 'INVALID_ID',
      });
      return;
    }
    if (error instanceof MongooseError.ValidationError) {
      res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message,
        code: 'VALIDATION_FAILED',
      });
      return;
    }
    this.logger.error(error.message, error.stack);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Database error',
      code: 'DATABASE_ERROR',
    });
  }
}
