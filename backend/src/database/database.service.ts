import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import mongoose from 'mongoose';
import { InjectEnv, type Env } from '../config/config.module.js';

/**
 * Single MongoDB connection for the process. Models are registered at import
 * time and share this connection. Nest calls `onModuleDestroy` on shutdown
 * because `configureApp` enables shutdown hooks.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(@InjectEnv() private readonly env: Env) {}

  async onModuleInit() {
    mongoose.set('strictQuery', true);
    mongoose.connection.on('error', (err: Error) => {
      this.logger.error(`MongoDB connection error: ${err.message}`);
    });
    mongoose.connection.on('disconnected', () => {
      this.logger.warn('MongoDB disconnected');
    });
    try {
      await mongoose.connect(this.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10_000,
        autoIndex: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to connect to MongoDB: ${message}`);
      throw new Error(`Failed to connect to MongoDB: ${message}`);
    }
    this.logger.log('MongoDB connected');
  }

  async ping(): Promise<void> {
    const db = mongoose.connection.db;
    if (!db || mongoose.connection.readyState !== 1) throw new Error('MongoDB is not connected');
    await db.command({ ping: 1 });
  }

  async onModuleDestroy() {
    if (mongoose.connection.readyState === 0) return;
    await mongoose.disconnect();
  }
}
