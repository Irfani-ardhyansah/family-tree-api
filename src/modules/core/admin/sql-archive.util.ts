import { deflateRawSync, inflateRawSync, gunzipSync, crc32 } from 'zlib';

function u16(n: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n, 0);
  return b;
}

function u32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

/** Single-entry ZIP (DEFLATE) — no extra deps. */
export function zipOneFile(entryName: string, data: Buffer): Buffer {
  const nameBuf = Buffer.from(entryName, 'utf8');
  const compressed = deflateRawSync(data, { level: 9 });
  const crc = crc32(data) >>> 0;
  const method = 8;

  const local = Buffer.concat([
    u32(0x04034b50),
    u16(20),
    u16(0),
    u16(method),
    u16(0),
    u16(0),
    u32(crc),
    u32(compressed.length),
    u32(data.length),
    u16(nameBuf.length),
    u16(0),
    nameBuf,
    compressed,
  ]);

  const central = Buffer.concat([
    u32(0x02014b50),
    u16(20),
    u16(20),
    u16(0),
    u16(method),
    u16(0),
    u16(0),
    u32(crc),
    u32(compressed.length),
    u32(data.length),
    u16(nameBuf.length),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(0),
    u32(0),
    nameBuf,
  ]);

  const end = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(1),
    u16(1),
    u32(central.length),
    u32(local.length),
    u16(0),
  ]);

  return Buffer.concat([local, central, end]);
}

/** Extract first file from a simple ZIP (store or deflate). */
export function unzipFirstFile(buf: Buffer): { name: string; data: Buffer } {
  if (buf.length < 30 || buf.readUInt32LE(0) !== 0x04034b50) {
    throw new Error('Bukan file ZIP valid.');
  }

  const method = buf.readUInt16LE(8);
  const compSize = buf.readUInt32LE(18);
  const uncompSize = buf.readUInt32LE(22);
  const nameLen = buf.readUInt16LE(26);
  const extraLen = buf.readUInt16LE(28);
  const name = buf.subarray(30, 30 + nameLen).toString('utf8');
  const dataStart = 30 + nameLen + extraLen;
  const compressed = buf.subarray(dataStart, dataStart + compSize);

  let data: Buffer;
  if (method === 0) {
    data = Buffer.from(compressed);
  } else if (method === 8) {
    data = inflateRawSync(compressed);
  } else {
    throw new Error(`Metode kompresi ZIP tidak didukung (${method}).`);
  }

  if (uncompSize > 0 && data.length !== uncompSize) {
    // Some writers leave size 0 in local header; trust inflated length.
  }

  return { name, data };
}

export function looksLikeGzip(buf: Buffer): boolean {
  return buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
}

export function looksLikeZip(buf: Buffer): boolean {
  return buf.length >= 4 && buf.readUInt32LE(0) === 0x04034b50;
}

/** Normalize upload/CLI bytes to raw .sql text. */
export function extractSqlFromArchive(buf: Buffer, filenameHint = ''): Buffer {
  const lower = filenameHint.toLowerCase();

  if (lower.endsWith('.sql.zip') || lower.endsWith('.zip') || looksLikeZip(buf)) {
    const { name, data } = unzipFirstFile(buf);
    if (!name.toLowerCase().endsWith('.sql') && !looksLikeSql(data)) {
      throw new Error('ZIP tidak berisi file .sql.');
    }
    return data;
  }

  if (lower.endsWith('.sql.gz') || lower.endsWith('.gz') || looksLikeGzip(buf)) {
    return gunzipSync(buf);
  }

  if (lower.endsWith('.sql') || looksLikeSql(buf)) {
    return buf;
  }

  throw new Error('Format backup SQL tidak dikenali (pakai .sql.zip, .sql.gz, atau .sql).');
}

function looksLikeSql(buf: Buffer): boolean {
  const head = buf.subarray(0, Math.min(buf.length, 512)).toString('utf8').trimStart();
  return (
    head.startsWith('--') ||
    head.startsWith('/*') ||
    /^CREATE\s+/i.test(head) ||
    /^DROP\s+/i.test(head) ||
    /^SET\s+/i.test(head) ||
    /^INSERT\s+/i.test(head)
  );
}
