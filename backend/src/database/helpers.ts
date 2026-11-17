import { MongoServerError } from 'mongodb';
import mongoose, { Types, type ClientSession } from 'mongoose';

export function oid(id: string | Types.ObjectId): Types.ObjectId {
  return id instanceof Types.ObjectId ? id : new Types.ObjectId(id);
}

export function idString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Types.ObjectId) return value.toHexString();
  if (typeof value === 'object' && 'toHexString' in value && typeof value.toHexString === 'function') {
    return value.toHexString();
  }
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') return String(value);
  return '';
}

export function idStrings(values: readonly unknown[] | null | undefined): string[] {
  return (values ?? []).map((value) => idString(value));
}

export function sameId(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false;
  return idString(a) === idString(b);
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isDuplicateKey(err: unknown): err is MongoServerError {
  return err instanceof MongoServerError && err.code === 11000;
}

/**
 * Multi-document transaction. MongoDB only allows this on a replica set
 * (Atlas, the compose `mongo` service, or mongodb-memory-server).
 * The callback may run more than once if the driver retries a transient error.
 */
export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => fn(session));
  } finally {
    await session.endSession();
  }
}
