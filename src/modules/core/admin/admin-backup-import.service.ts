import type { Knex } from 'knex';
import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import { AdminModuleId, isAdminModuleId } from './admin.constants';

export type BackupExportPayload = {
  exportedAt?: string;
  familyId?: number;
  moduleIds?: string[];
  modules?: {
    roots?: {
      persons?: Record<string, unknown>[];
      details?: Record<string, unknown>[];
      lineage?: Record<string, unknown>[];
      spouses?: Record<string, unknown>[];
      addresses?: Record<string, unknown>[];
    };
    core?: {
      family?: Record<string, unknown> | null;
      members?: Record<string, unknown>[];
      moduleStatuses?: Record<string, unknown>[];
    };
    money?: unknown;
    household?: unknown;
  };
};

export type BackupImportResult = {
  mode: 'replace';
  targetFamilyId: number;
  personsImported: number;
  membersImported: number;
  moduleStatusesImported: number;
  remappedPersonIds: number;
};

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return null;
}

function pickDate(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value);
  return s.slice(0, 10);
}

function pickTimestamp(value: unknown): Date | string | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  return String(value);
}

export function parseBackupPayload(raw: unknown): BackupExportPayload {
  if (!raw || typeof raw !== 'object') {
    throw new Error('File backup tidak valid (bukan JSON object).');
  }
  const payload = raw as BackupExportPayload;
  if (!payload.modules || typeof payload.modules !== 'object') {
    throw new Error('File backup tidak punya field modules.');
  }
  return payload;
}

/**
 * Wipe family-scoped Roots + membership data, then re-import from JSON export.
 * Person IDs di-remap ke ID baru di target family.
 */
export async function importBackupReplaceFamily(
  targetFamilyId: number,
  payload: BackupExportPayload,
  options: { keepAdminPersonId?: number | null } = {},
): Promise<BackupImportResult> {
  const roots = payload.modules?.roots;
  const core = payload.modules?.core;
  const persons = roots?.persons;
  if (!persons || !Array.isArray(persons) || persons.length === 0) {
    throw new Error('Backup tidak berisi modules.roots.persons.');
  }

  return db.transaction(async (trx) => {
    await wipeFamilyData(trx, targetFamilyId);

    const familyMeta = core?.family ?? null;
    if (familyMeta && typeof familyMeta === 'object') {
      await trx(Tables.FAMILIES).where({ id: targetFamilyId }).update({
        name: typeof familyMeta.name === 'string' ? familyMeta.name : undefined,
        timezone: typeof familyMeta.timezone === 'string' ? familyMeta.timezone : undefined,
        currency: typeof familyMeta.currency === 'string' ? familyMeta.currency : undefined,
        logo_url: familyMeta.logo_url === undefined ? undefined : (familyMeta.logo_url as string | null),
        access_version:
          typeof familyMeta.access_version === 'number' ? familyMeta.access_version : undefined,
        updated_at: trx.fn.now(),
      });
    }

    const idMap = new Map<number, number>();

    for (const person of persons) {
      const oldId = asNumber(person.id);
      if (oldId == null) continue;

      const [newId] = await trx(Tables.PERSONS).insert({
        family_id: targetFamilyId,
        full_name: String(person.full_name ?? 'Tanpa Nama'),
        nickname: (person.nickname as string | null) ?? null,
        gender: person.gender === 'female' ? 'female' : 'male',
        birth_date: pickDate(person.birth_date) ?? '1970-01-01',
        death_date: pickDate(person.death_date),
        status: person.status === 'deceased' ? 'deceased' : 'alive',
        deleted_at: null,
        created_at: pickTimestamp(person.created_at) ?? trx.fn.now(),
        updated_at: pickTimestamp(person.updated_at) ?? trx.fn.now(),
      });
      idMap.set(oldId, Number(newId));
    }

    const details = Array.isArray(roots?.details) ? roots.details : [];
    for (const row of details) {
      const oldPersonId = asNumber(row.person_id);
      const newPersonId = oldPersonId != null ? idMap.get(oldPersonId) : undefined;
      if (newPersonId == null) continue;
      await trx(Tables.PERSON_DETAILS).insert({
        person_id: newPersonId,
        religion: (row.religion as string | null) ?? null,
        photo_url: (row.photo_url as string | null) ?? null,
        occupation: (row.occupation as string | null) ?? null,
        phone: (row.phone as string | null) ?? null,
        phone_alt: (row.phone_alt as string | null) ?? null,
        created_at: pickTimestamp(row.created_at) ?? trx.fn.now(),
        updated_at: pickTimestamp(row.updated_at) ?? trx.fn.now(),
      });
    }

    const lineage = Array.isArray(roots?.lineage) ? roots.lineage : [];
    for (const row of lineage) {
      const oldPersonId = asNumber(row.person_id);
      const newPersonId = oldPersonId != null ? idMap.get(oldPersonId) : undefined;
      if (newPersonId == null) continue;
      const fatherOld = asNumber(row.father_id);
      const motherOld = asNumber(row.mother_id);
      await trx(Tables.PERSON_LINEAGE).insert({
        person_id: newPersonId,
        father_id: fatherOld != null ? (idMap.get(fatherOld) ?? null) : null,
        mother_id: motherOld != null ? (idMap.get(motherOld) ?? null) : null,
      });
    }

    const spouses = Array.isArray(roots?.spouses) ? roots.spouses : [];
    const seenPairs = new Set<string>();
    for (const row of spouses) {
      const aOld = asNumber(row.person_id_a);
      const bOld = asNumber(row.person_id_b);
      const a = aOld != null ? idMap.get(aOld) : undefined;
      const b = bOld != null ? idMap.get(bOld) : undefined;
      if (a == null || b == null || a === b) continue;
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      await trx(Tables.PERSON_SPOUSES).insert({
        person_id_a: Math.min(a, b),
        person_id_b: Math.max(a, b),
      });
    }

    const addresses = Array.isArray(roots?.addresses) ? roots.addresses : [];
    for (const row of addresses) {
      const oldPersonId = asNumber(row.person_id);
      const newPersonId = oldPersonId != null ? idMap.get(oldPersonId) : undefined;
      if (newPersonId == null) continue;
      await trx(Tables.PERSON_ADDRESSES).insert({
        person_id: newPersonId,
        street: (row.street as string | null) ?? null,
        district: (row.district as string | null) ?? null,
        city: (row.city as string | null) ?? null,
        province: (row.province as string | null) ?? null,
        postal_code: (row.postal_code as string | null) ?? null,
        country: (row.country as string | null) ?? null,
        latitude: row.latitude ?? null,
        longitude: row.longitude ?? null,
        created_at: pickTimestamp(row.created_at) ?? trx.fn.now(),
        updated_at: pickTimestamp(row.updated_at) ?? trx.fn.now(),
      });
    }

    // family members
    const members = Array.isArray(core?.members) ? core.members : [];
    let membersImported = 0;
    for (const row of members) {
      const oldPersonId = asNumber(row.person_id);
      const newPersonId = oldPersonId != null ? idMap.get(oldPersonId) : undefined;
      if (newPersonId == null) continue;
      await trx(Tables.FAMILY_MEMBERS).insert({
        family_id: targetFamilyId,
        person_id: newPersonId,
        role: row.role === 'admin' ? 'admin' : 'member',
        created_at: pickTimestamp(row.created_at) ?? trx.fn.now(),
        updated_at: pickTimestamp(row.updated_at) ?? trx.fn.now(),
      });
      membersImported += 1;
    }

    // Ensure importer stays admin if they exist outside wipe... wipe removed all members.
    // keepAdminPersonId only works if that person still exists in another family — usually not.
    // After import, if no admin, promote first remapped person or leave as-is from backup.

    const moduleRows = Array.isArray(core?.moduleStatuses) ? core.moduleStatuses : [];
    let moduleStatusesImported = 0;
    for (const row of moduleRows) {
      const moduleId = typeof row.module_id === 'string' ? row.module_id : '';
      if (!isAdminModuleId(moduleId)) continue;
      const updatedByOld = asNumber(row.updated_by_person_id);
      await trx(Tables.MODULE_STATUSES).insert({
        family_id: targetFamilyId,
        module_id: moduleId as AdminModuleId,
        enabled: row.enabled === false || row.enabled === 0 ? false : true,
        updated_by_person_id:
          updatedByOld != null ? (idMap.get(updatedByOld) ?? null) : null,
        created_at: pickTimestamp(row.created_at) ?? trx.fn.now(),
        updated_at: pickTimestamp(row.updated_at) ?? trx.fn.now(),
      });
      moduleStatusesImported += 1;
    }

    const oldRootId = familyMeta ? asNumber(familyMeta.root_person_id) : null;
    const newRootId = oldRootId != null ? (idMap.get(oldRootId) ?? null) : null;
    await trx(Tables.FAMILIES).where({ id: targetFamilyId }).update({
      root_person_id: newRootId,
      updated_at: trx.fn.now(),
    });

    void options;
    return {
      mode: 'replace' as const,
      targetFamilyId,
      personsImported: idMap.size,
      membersImported,
      moduleStatusesImported,
      remappedPersonIds: idMap.size,
    };
  });
}

async function wipeFamilyData(trx: Knex.Transaction, familyId: number): Promise<void> {
  await trx(Tables.FAMILIES).where({ id: familyId }).update({
    root_person_id: null,
    updated_at: trx.fn.now(),
  });

  const personRows = await trx(Tables.PERSONS).where({ family_id: familyId }).select<{ id: number }[]>('id');
  const personIds = personRows.map((r) => r.id);

  // Money Track (RESTRICT ke person) — hapus via workspace family dulu
  if (await trx.schema.hasTable(Tables.MONEY_WORKSPACES)) {
    await trx(Tables.MONEY_WORKSPACES).where({ family_id: familyId }).del();
  }

  if (personIds.length === 0) {
    await trx(Tables.MODULE_STATUSES).where({ family_id: familyId }).del();
    await trx(Tables.FAMILY_MEMBERS).where({ family_id: familyId }).del();
    return;
  }

  await trx(Tables.NOTIFICATIONS).where({ family_id: familyId }).del();
  await trx(Tables.BROADCASTS).where({ family_id: familyId }).del();
  await trx(Tables.BACKUP_JOBS).where({ family_id: familyId }).del();
  await trx(Tables.ADMIN_AUDIT_LOGS).where({ family_id: familyId }).del();
  await trx(Tables.MODULE_STATUSES).where({ family_id: familyId }).del();

  await trx(Tables.PUSH_SUBSCRIPTIONS).whereIn('person_id', personIds).del();
  await trx(Tables.SECONDARY_PASSWORDS).whereIn('person_id', personIds).del();
  await trx(Tables.PERSON_OPTIONS).whereIn('person_id', personIds).del();
  await trx(Tables.REFRESH_TOKENS).whereIn('person_id', personIds).del();

  if (await trx.schema.hasTable(Tables.MEDIA)) {
    await trx(Tables.MEDIA).where({ family_id: familyId }).del();
  }

  await trx(Tables.EVENTS).where({ family_id: familyId }).del();
  await trx(Tables.MEMORIAM_TRIBUTES).where({ family_id: familyId }).del();
  await trx(Tables.MEMORIAM_PRAYERS).where({ family_id: familyId }).del();
  await trx(Tables.PERSON_IMPORT_JOBS).where({ family_id: familyId }).del();

  await trx(Tables.PERSON_ADDRESSES).whereIn('person_id', personIds).del();
  await trx(Tables.PERSON_SPOUSES)
    .where(function spouseWipe() {
      this.whereIn('person_id_a', personIds).orWhereIn('person_id_b', personIds);
    })
    .del();
  await trx(Tables.PERSON_LINEAGE).whereIn('person_id', personIds).del();
  await trx(Tables.PERSON_DETAILS).whereIn('person_id', personIds).del();
  await trx(Tables.FAMILY_MEMBERS).where({ family_id: familyId }).del();
  await trx(Tables.PERSONS).where({ family_id: familyId }).del();
}

