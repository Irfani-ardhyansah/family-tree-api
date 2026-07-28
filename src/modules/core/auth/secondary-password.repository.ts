import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';

export type SecondaryPasswordRow = {
  person_id: number;
  password_hash: string;
  set_at: Date | string;
};

export class SecondaryPasswordRepository {
  async findByPersonId(personId: number): Promise<SecondaryPasswordRow | undefined> {
    return db(Tables.SECONDARY_PASSWORDS)
      .where({ person_id: personId })
      .first<SecondaryPasswordRow>('person_id', 'password_hash', 'set_at');
  }

  async isSet(personId: number): Promise<boolean> {
    const row = await db(Tables.SECONDARY_PASSWORDS)
      .where({ person_id: personId })
      .first<{ person_id: number }>('person_id');
    return Boolean(row);
  }

  async insert(personId: number, passwordHash: string): Promise<void> {
    await db(Tables.SECONDARY_PASSWORDS).insert({
      person_id: personId,
      password_hash: passwordHash,
      set_at: db.fn.now(),
    });
  }

  async updateHash(personId: number, passwordHash: string): Promise<void> {
    await db(Tables.SECONDARY_PASSWORDS).where({ person_id: personId }).update({
      password_hash: passwordHash,
      set_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
  }
}

export const secondaryPasswordRepository = new SecondaryPasswordRepository();
