import type { Types } from 'mongoose';

/**
 * Document and query shapes used by the API.
 *
 * These mirror the Mongoose calls in this codebase without instantiating
 * Mongoose's generic `Model` / `HydratedDocument` types, which exhaust the
 * TypeScript checker (Mongoose 8 + TypeScript 6). The values are still real
 * Mongoose models; only the static type is narrowed.
 */
export interface MongoDoc {
  _id: Types.ObjectId;
  id: string;
  get(path: string): unknown;
  toObject(): Record<string, unknown>;
}

export type Doc<T> = T & MongoDoc;

export interface Query<T> extends Promise<Doc<T>[]> {
  select(fields: string): this;
  sort(spec: Record<string, 1 | -1>): this;
  limit(n: number): this;
  populate<Populated = unknown>(path: Populated extends unknown ? string : never, select?: string): this;
  session(session: unknown): this;
}

export interface OneQuery<T> extends Promise<Doc<T> | null> {
  select(fields: string): this;
  populate<Populated = unknown>(path: Populated extends unknown ? string : never, select?: string): this;
  session(session: unknown): this;
}

export interface Aggregate<R> extends Promise<R[]> {
  session(session: unknown): this;
}

export interface WriteResult {
  modifiedCount: number;
  matchedCount: number;
}

export interface Collection<T> {
  find(filter?: object): Query<T>;
  findOne(filter?: object): OneQuery<T>;
  findById(id: unknown): OneQuery<T>;
  findByIdAndUpdate(id: unknown, update: object, options?: object): Promise<Doc<T> | null>;
  findOneAndUpdate(filter: object, update: object, options?: object): Promise<Doc<T> | null>;
  create(docs: readonly object[], options?: object): Promise<Doc<T>[]>;
  create(doc: object, options?: object): Promise<Doc<T>>;
  insertMany(docs: readonly object[], options?: object): Promise<Doc<T>[]>;
  updateOne(filter: object, update: object, options?: object): Promise<WriteResult>;
  updateMany(filter: object, update: object, options?: object): Promise<WriteResult>;
  deleteOne(filter: object, options?: object): Promise<WriteResult>;
  deleteMany(filter: object, options?: object): Promise<WriteResult>;
  countDocuments(filter?: object): Promise<number>;
  exists(filter: object): Promise<{ _id: Types.ObjectId } | null>;
  aggregate<R = unknown>(pipeline: readonly object[]): Aggregate<R>;
  distinct(field: string, filter?: object): Promise<unknown[]>;
}
