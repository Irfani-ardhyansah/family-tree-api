import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { env } from '../../config/env';
import { STORAGE_DIR_BY_PURPOSE } from './media.constants';

function resolveStorageDir(): string {
  return path.resolve(process.cwd(), env.media.storageDir);
}

export function buildPublicUrl(storageKey: string): string {
  const base = env.media.publicBaseUrl.replace(/\/$/, '');
  return `${base}/${storageKey}`;
}

export function isManagedMediaUrl(url: string): boolean {
  const base = env.media.publicBaseUrl.replace(/\/$/, '');
  return url.startsWith(`${base}/`);
}

export class LocalMediaStorage {
  async ensureReady(): Promise<void> {
    const root = resolveStorageDir();
    await mkdir(root, { recursive: true });
    const subdirs = [...new Set(Object.values(STORAGE_DIR_BY_PURPOSE))];
    await Promise.all(subdirs.map((dir) => mkdir(path.join(root, dir), { recursive: true })));
  }

  getAbsolutePath(storageKey: string): string {
    const root = resolveStorageDir();
    const absolute = path.resolve(root, storageKey);
    if (!absolute.startsWith(root + path.sep) && absolute !== root) {
      throw new Error('Invalid storage key');
    }
    return absolute;
  }

  async save(storageKey: string, buffer: Buffer): Promise<void> {
    await this.ensureReady();
    const absolute = this.getAbsolutePath(storageKey);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, buffer);
  }

  async remove(storageKey: string): Promise<void> {
    try {
      await unlink(this.getAbsolutePath(storageKey));
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  getStaticRoot(): string {
    return resolveStorageDir();
  }
}

export const mediaStorage = new LocalMediaStorage();
