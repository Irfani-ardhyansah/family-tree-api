import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';
import { calendarEventTypesRepository } from '../../modules/family-core/calendar-event-types/calendar-event-types.repository';
import { documentTypesRepository } from '../../modules/family-core/document-types/document-types.repository';

/**
 * Idempotent Family Core type seeds.
 * Only inserts missing system types per family — never deletes mt_* or existing fc rows.
 */
export async function seed(knex: Knex): Promise<void> {
  const families = await knex(Tables.FAMILIES).select<{ id: number }[]>('id');
  if (families.length === 0) {
    console.warn('[family-core seed] No families — skip.');
    return;
  }

  for (const family of families) {
    await documentTypesRepository.ensureSystemTypes(family.id);
    await calendarEventTypesRepository.ensureSystemTypes(family.id);
  }

  console.log(
    `[family-core seed] Ensured document + calendar event types for ${families.length} family(ies).`,
  );
}
