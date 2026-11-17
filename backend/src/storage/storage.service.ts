import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { InjectEnv, type Env } from '../config/config.module.js';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

export const KEY_REGEX = /^[a-z0-9-]+\.(jpg|png|webp|mp4|webm)$/;

@Injectable()
export class StorageService {
  private readonly s3?: S3Client;
  private readonly localDir: string;

  constructor(@InjectEnv() private readonly env: Env) {
    this.localDir = resolve(env.STORAGE_LOCAL_DIR);
    if (env.STORAGE_DRIVER === 's3') {
      this.s3 = new S3Client({
        region: env.S3_REGION,
        ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT, forcePathStyle: true } : {}),
        ...(env.S3_ACCESS_KEY_ID
          ? { credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY } }
          : {}),
      });
    }
  }

  async put(prefix: string, body: Buffer, contentType: string): Promise<{ key: string; url: string }> {
    const ext = EXT_BY_MIME[contentType];
    if (!ext) throw new BadRequestException(`Unsupported file type ${contentType}`);
    const key = `${prefix}-${randomUUID()}.${ext}`.toLowerCase();

    if (this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.env.S3_BUCKET,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    } else {
      await mkdir(this.localDir, { recursive: true });
      await writeFile(join(this.localDir, key), body);
    }
    return { key, url: this.publicUrl(key) };
  }

  publicUrl(key: string): string {
    if (this.env.STORAGE_DRIVER === 's3') return `${this.env.S3_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
    return `${this.env.API_PUBLIC_URL.replace(/\/$/, '')}/api/v1/media/${key}`;
  }

  async readLocal(key: string): Promise<{ body: Buffer; contentType: string }> {
    if (this.env.STORAGE_DRIVER !== 'local' || !KEY_REGEX.test(key)) throw new NotFoundException();
    const ext = key.split('.').pop()!;
    const contentType = Object.entries(EXT_BY_MIME).find(([, e]) => e === ext)![0];
    try {
      return { body: await readFile(join(this.localDir, key)), contentType };
    } catch {
      throw new NotFoundException();
    }
  }
}
