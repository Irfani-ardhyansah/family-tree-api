/**
 * Import admin JSON backup into a family (replace roots+core).
 *
 * Usage:
 *   npx ts-node scripts/backup-import-json.ts --file=./backup.json --family-id=1
 *
 * After import, login codes follow persons in the file (IDs remapped).
 * You may need to re-login; previous sessions for wiped persons are gone.
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
  const args = process.argv.slice(2);
  const fileArg = args.find((a) => a.startsWith('--file='))?.slice('--file='.length);
  const familyArg = args.find((a) => a.startsWith('--family-id='))?.slice('--family-id='.length);

  if (!fileArg || !familyArg) {
    console.error(
      'Usage: npx ts-node scripts/backup-import-json.ts --file=./path/backup.json --family-id=1',
    );
    process.exit(1);
  }

  const familyId = Number(familyArg);
  if (!Number.isInteger(familyId) || familyId <= 0) {
    console.error('--family-id harus integer positif');
    process.exit(1);
  }

  const abs = path.resolve(fileArg);
  if (!fs.existsSync(abs)) {
    console.error(`File tidak ditemukan: ${abs}`);
    process.exit(1);
  }

  const { adminBackupService } = await import(
    '../src/modules/core/admin/admin-backup.service'
  );

  console.log(`Import ${abs} → familyId=${familyId} (REPLACE)…`);
  const result = await adminBackupService.importJsonFromPath(familyId, abs);
  console.log('OK:', result);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
