import db from '../../config/database';
import { CreateTributeInput, PrayerRow, TributePhotoRow, TributeRow } from './memoriam.types';

export class MemoriamRepository {
  async countTributesByDeceasedIds(deceasedIds: number[]): Promise<Map<number, number>> {
    if (deceasedIds.length === 0) {
      return new Map();
    }

    const rows = await db('memoriam_tributes')
      .whereIn('deceased_person_id', deceasedIds)
      .whereNull('deleted_at')
      .groupBy('deceased_person_id')
      .select<{ deceased_person_id: number; count: number }[]>(
        'deceased_person_id',
        db.raw('COUNT(*) as count'),
      );

    return new Map(rows.map((row) => [row.deceased_person_id, Number(row.count)]));
  }

  async countPrayersByDeceasedIds(deceasedIds: number[]): Promise<Map<number, number>> {
    if (deceasedIds.length === 0) {
      return new Map();
    }

    const rows = await db('memoriam_prayers')
      .whereIn('deceased_person_id', deceasedIds)
      .groupBy('deceased_person_id')
      .select<{ deceased_person_id: number; count: number }[]>(
        'deceased_person_id',
        db.raw('COUNT(*) as count'),
      );

    return new Map(rows.map((row) => [row.deceased_person_id, Number(row.count)]));
  }

  async findTributes(familyId: number, deceasedId: number): Promise<TributeRow[]> {
    return db('memoriam_tributes as t')
      .innerJoin('persons as p', 'p.id', 't.author_person_id')
      .where({
        't.family_id': familyId,
        't.deceased_person_id': deceasedId,
      })
      .whereNull('t.deleted_at')
      .orderBy('t.created_at', 'desc')
      .select<TributeRow[]>(
        't.id',
        't.family_id',
        't.deceased_person_id',
        't.author_person_id',
        't.content',
        't.created_at',
        't.updated_at',
        't.deleted_at',
        db.raw('p.full_name as author_name'),
      );
  }

  async findTributePhotosByTributeIds(tributeIds: number[]): Promise<Map<number, string[]>> {
    if (tributeIds.length === 0) {
      return new Map();
    }

    const rows = await db('memoriam_tribute_photos')
      .whereIn('tribute_id', tributeIds)
      .orderBy('sort_order', 'asc')
      .select<TributePhotoRow[]>('*');

    const map = new Map<number, string[]>();
    for (const row of rows) {
      const list = map.get(row.tribute_id) ?? [];
      list.push(row.photo_url);
      map.set(row.tribute_id, list);
    }
    return map;
  }

  async createTribute(
    familyId: number,
    deceasedId: number,
    authorPersonId: number,
    input: CreateTributeInput,
  ): Promise<number> {
    return db.transaction(async (trx) => {
      const [tributeId] = await trx('memoriam_tributes').insert({
        family_id: familyId,
        deceased_person_id: deceasedId,
        author_person_id: authorPersonId,
        content: input.content,
      });

      const id = Number(tributeId);
      if (input.photoUrls.length > 0) {
        await trx('memoriam_tribute_photos').insert(
          input.photoUrls.map((photoUrl, index) => ({
            tribute_id: id,
            photo_url: photoUrl,
            sort_order: index,
          })),
        );
      }
      return id;
    });
  }

  async findPrayers(familyId: number, deceasedId: number): Promise<PrayerRow[]> {
    return db('memoriam_prayers as mp')
      .innerJoin('persons as p', 'p.id', 'mp.author_person_id')
      .where({
        'mp.family_id': familyId,
        'mp.deceased_person_id': deceasedId,
      })
      .orderBy('mp.created_at', 'desc')
      .select<PrayerRow[]>(
        'mp.id',
        'mp.family_id',
        'mp.deceased_person_id',
        'mp.author_person_id',
        'mp.created_at',
        db.raw('p.full_name as author_name'),
      );
  }

  async findPrayerByAuthor(
    deceasedId: number,
    authorPersonId: number,
  ): Promise<{ id: number } | undefined> {
    return db('memoriam_prayers')
      .where({ deceased_person_id: deceasedId, author_person_id: authorPersonId })
      .first<{ id: number }>('id');
  }

  async insertPrayer(
    familyId: number,
    deceasedId: number,
    authorPersonId: number,
  ): Promise<number> {
    const [id] = await db('memoriam_prayers').insert({
      family_id: familyId,
      deceased_person_id: deceasedId,
      author_person_id: authorPersonId,
    });
    return Number(id);
  }
}

export const memoriamRepository = new MemoriamRepository();
