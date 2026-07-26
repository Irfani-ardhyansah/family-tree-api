import { appendFile, mkdir } from 'fs/promises';
import path from 'path';
import { env } from '../../config/env';

const LOG_DIR = path.resolve(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

function stamp(): string {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

/**
 * Append-only file log (mirip laravel.log). Best-effort — jangan throw ke request.
 */
export async function appendAppLogLine(
  level: 'ERROR' | 'INFO' | 'WARNING',
  message: string,
  context?: Record<string, unknown>,
): Promise<void> {
  try {
    await mkdir(LOG_DIR, { recursive: true });
    const envName = env.nodeEnv || 'local';
    const ctx = context ? ` ${JSON.stringify(context)}` : '';
    const line = `[${stamp()}] ${envName}.${level}: ${message}${ctx}\n`;
    await appendFile(LOG_FILE, line, 'utf8');
  } catch (error) {
    if (!env.isProduction) {
      console.error('[fileLogger] failed to write logs/app.log', error);
    }
  }
}

export function getAppLogFilePath(): string {
  return LOG_FILE;
}
