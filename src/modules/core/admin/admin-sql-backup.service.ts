import { spawn, spawnSync } from 'child_process';
import { env } from '../../../config/env';
import { extractSqlFromArchive, zipOneFile } from './sql-archive.util';

function mysqlEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    MYSQL_PWD: env.db.password,
  };
}

/** Alpine `mysql-client` = MariaDB; prefer mariadb-* to avoid deprecation + bad flags. */
function resolveBinary(candidates: string[]): string {
  for (const name of candidates) {
    const result = spawnSync('sh', ['-c', `command -v ${JSON.stringify(name)}`], {
      encoding: 'utf8',
    });
    const path = result.stdout?.trim();
    if (result.status === 0 && path) {
      return path;
    }
  }
  return candidates[0]!;
}

/** True only for Oracle MySQL client — MariaDB rejects the flag. */
function supportsSetGtidPurged(dumpBinary: string): boolean {
  const result = spawnSync(dumpBinary, ['--help'], { encoding: 'utf8' });
  const text = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  return /\bset-gtid-purged\b/i.test(text);
}

function dumpArgs(dumpBinary: string): string[] {
  const args = [
    '-h',
    env.db.host,
    '-P',
    String(env.db.port),
    '-u',
    env.db.user,
    '--single-transaction',
    '--routines',
    '--triggers',
  ];
  if (supportsSetGtidPurged(dumpBinary)) {
    args.push('--set-gtid-purged=OFF');
  }
  args.push(env.db.name);
  return args;
}

function clientArgs(): string[] {
  return ['-h', env.db.host, '-P', String(env.db.port), '-u', env.db.user, env.db.name];
}

function runCollectStdout(cmd: string, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: mysqlEnv() });
    const out: Buffer[] = [];
    const err: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => out.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => err.push(chunk));
    child.on('error', (error) => {
      reject(
        new Error(
          `${cmd} tidak tersedia (${error.message}). Install mysql-client / mariadb-client di host/container.`,
        ),
      );
    });
    child.on('close', (code) => {
      if (code !== 0) {
        const detail = Buffer.concat(err).toString('utf8').trim() || `exit ${code}`;
        reject(new Error(`Dump gagal (${cmd}): ${detail}`));
        return;
      }
      resolve(Buffer.concat(out));
    });
  });
}

function runWithStdin(cmd: string, args: string[], stdin: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: mysqlEnv() });
    const err: Buffer[] = [];

    child.stderr.on('data', (chunk: Buffer) => err.push(chunk));
    child.on('error', (error) => {
      reject(
        new Error(
          `${cmd} tidak tersedia (${error.message}). Install mysql-client / mariadb-client di host/container.`,
        ),
      );
    });
    child.on('close', (code) => {
      if (code !== 0) {
        const detail = Buffer.concat(err).toString('utf8').trim() || `exit ${code}`;
        reject(new Error(`Restore gagal (${cmd}): ${detail}`));
        return;
      }
      resolve();
    });

    child.stdin.on('error', (error) => {
      reject(new Error(`Gagal menulis ke ${cmd}: ${error.message}`));
    });
    child.stdin.end(stdin);
  });
}

/** Full DB dump → single-entry .sql.zip buffer. */
export async function createSqlZipDump(): Promise<{ zip: Buffer; entryName: string }> {
  const dumpBin = resolveBinary(['mariadb-dump', 'mysqldump']);
  const sql = await runCollectStdout(dumpBin, dumpArgs(dumpBin));
  if (sql.length === 0) {
    throw new Error('Dump SQL menghasilkan file kosong.');
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const entryName = `family-tree-${stamp}.sql`;
  return { zip: zipOneFile(entryName, sql), entryName };
}

/** Restore from .sql.zip / .sql.gz / .sql bytes. Overwrites DB_NAME. */
export async function restoreSqlArchive(buf: Buffer, filenameHint = ''): Promise<void> {
  const sql = extractSqlFromArchive(buf, filenameHint);
  if (sql.length === 0) {
    throw new Error('File SQL kosong.');
  }
  const clientBin = resolveBinary(['mariadb', 'mysql']);
  await runWithStdin(clientBin, clientArgs(), sql);
}
