import { createHash, createHmac, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);

export const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

export const hmacSha256 = (secret: string, value: string | Buffer) =>
  createHmac('sha256', secret).update(value).digest('hex');

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

export const randomOtp = () => randomInt(0, 1_000_000).toString().padStart(6, '0');

/** URL-safe, unambiguous code for invitation links (no 0/O/1/l). */
/** Stored as `scrypt$<salt>$<hash>`. Never log or return this value. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('base64url');
  const hash = (await scrypt(password, salt, 32)) as Buffer;
  return `scrypt$${salt}$${hash.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, salt, digest] = stored.split('$');
  if (kind !== 'scrypt' || !salt || !digest) return false;
  const hash = (await scrypt(password, salt, 32)) as Buffer;
  const expected = Buffer.from(digest, 'base64url');
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

export function randomCode(length = 10): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[randomInt(0, alphabet.length)];
  return out;
}
