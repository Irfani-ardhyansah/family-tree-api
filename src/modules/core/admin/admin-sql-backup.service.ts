import { spawn } from 'child_process';
import { env } from '../../../config/env';
import { extractSqlFromArchive, zipOneFile } from './sql-archive.util';

function mysqlEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    MYSQL_PWD: env.db.password,
  };
}

function dumpArgs(): string[] {
  return [
    '-h',
    env.db.host,
    '-P',
    String(env.db.port),
    '-u',
    env.db.user,
    '--single-transaction',
    '--routines',
    '--triggers',
    '--set-gtid-purged=OFF',
    env.db.name,
  ];
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
          `${cmd} tidak tersedia (${error.message}). Install mysql-client di host/container.`,
        ),
      );
    });
    child.on('close', (code) => {
      if (code !== 0) {
        const detail = Buffer.concat(err).toString('utf8').trim() || `exit ${code}`;
        reject(new Error(`${cmd} gagal: ${detail}`));
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
          `${cmd} tidak tersedia (${error.message}). Install mysql-client di host/container.`,
        ),
      );
    });
    child.on('close', (code) => {
      if (code !== 0) {
        const detail = Buffer.concat(err).toString('utf8').trim() || `exit ${code}`;
        reject(new Error(`${cmd} restore gagal: ${detail}`));
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
  const sql = await runCollectStdout('mysqldump', dumpArgs());
  if (sql.length === 0) {
    throw new Error('mysqldump menghasilkan file kosong.');
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
  await runWithStdin('mysql', clientArgs(), sql);
}
