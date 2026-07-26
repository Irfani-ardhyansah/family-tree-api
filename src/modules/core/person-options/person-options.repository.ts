import db from '../../../config/database';
import { PersonOptionRow, PersonOptionsMap } from './person-options.types';
import { Tables } from '../../../shared/database/tables';

export class PersonOptionsRepository {
  async findByPersonId(personId: number): Promise<PersonOptionRow[]> {
    return db(Tables.PERSON_OPTIONS).where({ person_id: personId }).select<PersonOptionRow[]>('*');
  }

  async findByPersonAndSetting(
    personId: number,
    setting: string,
  ): Promise<PersonOptionRow | undefined> {
    return db(Tables.PERSON_OPTIONS)
      .where({ person_id: personId, setting })
      .first<PersonOptionRow>('*');
  }

  async upsert(personId: number, setting: string, value: string): Promise<void> {
    const existing = await this.findByPersonAndSetting(personId, setting);
    if (existing) {
      await db(Tables.PERSON_OPTIONS)
        .where({ person_id: personId, setting })
        .update({ value, updated_at: db.fn.now() });
      return;
    }

    await db(Tables.PERSON_OPTIONS).insert({
      person_id: personId,
      setting,
      value,
    });
  }

  async deleteByPersonAndSetting(personId: number, setting: string): Promise<void> {
    await db(Tables.PERSON_OPTIONS).where({ person_id: personId, setting }).del();
  }

  rowsToMap(rows: PersonOptionRow[]): PersonOptionsMap {
    const map: PersonOptionsMap = {};
    for (const row of rows) {
      map[row.setting] = row.value;
    }
    return map;
  }
}

export const personOptionsRepository = new PersonOptionsRepository();
