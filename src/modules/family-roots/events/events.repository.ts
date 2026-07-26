import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import {
  ContributionRow,
  EventPhotoRow,
  EventRow,
  UpsertEventInput,
} from './events.types';

export class EventsRepository {
  async findByFamily(
    familyId: number,
    filters: {
      type?: string;
      year?: number;
      month?: number;
      dateFrom?: string;
      dateTo?: string;
      q?: string;
    },
  ): Promise<EventRow[]> {
    let query = db(Tables.EVENTS)
      .where({ family_id: familyId })
      .whereNull('deleted_at')
      .orderBy('date', 'desc')
      .orderBy('id', 'desc');

    if (filters.type) {
      query = query.where('type', filters.type);
    }
    if (filters.year) {
      query = query.whereRaw('YEAR(`date`) = ?', [filters.year]);
    }
    if (filters.month) {
      query = query.whereRaw('MONTH(`date`) = ?', [filters.month]);
    }
    // Overlap range: event.date <= dateTo AND COALESCE(end_date, date) >= dateFrom
    // (multi-day events that start before the window but end inside still match)
    if (filters.dateFrom) {
      query = query.whereRaw('COALESCE(`end_date`, `date`) >= ?', [filters.dateFrom]);
    }
    if (filters.dateTo) {
      query = query.where('date', '<=', filters.dateTo);
    }
    if (filters.q) {
      const like = `%${filters.q}%`;
      query = query.where(function search() {
        this.where('title', 'like', like)
          .orWhere('location', 'like', like)
          .orWhere('description', 'like', like);
      });
    }

    return query.select<EventRow[]>('*');
  }

  async findById(familyId: number, eventId: number): Promise<EventRow | undefined> {
    return db(Tables.EVENTS)
      .where({ id: eventId, family_id: familyId })
      .whereNull('deleted_at')
      .first<EventRow>('*');
  }

  async findPersonIdsByEventIds(eventIds: number[]): Promise<Map<number, number[]>> {
    if (eventIds.length === 0) {
      return new Map();
    }

    const rows = await db(Tables.EVENT_PERSONS)
      .whereIn('event_id', eventIds)
      .select<{ event_id: number; person_id: number }[]>('event_id', 'person_id');

    const map = new Map<number, number[]>();
    for (const row of rows) {
      const list = map.get(row.event_id) ?? [];
      list.push(row.person_id);
      map.set(row.event_id, list);
    }
    return map;
  }

  async findAttendeeIdsByEventIds(eventIds: number[]): Promise<Map<number, number[]>> {
    if (eventIds.length === 0) {
      return new Map();
    }

    const rows = await db(Tables.EVENT_ATTENDEES)
      .whereIn('event_id', eventIds)
      .select<{ event_id: number; person_id: number }[]>('event_id', 'person_id');

    const map = new Map<number, number[]>();
    for (const row of rows) {
      const list = map.get(row.event_id) ?? [];
      list.push(row.person_id);
      map.set(row.event_id, list);
    }
    return map;
  }

  async findPhotosByEventIds(eventIds: number[]): Promise<Map<number, string[]>> {
    if (eventIds.length === 0) {
      return new Map();
    }

    const rows = await db(Tables.EVENT_PHOTOS)
      .whereIn('event_id', eventIds)
      .orderBy('sort_order', 'asc')
      .select<EventPhotoRow[]>('*');

    const map = new Map<number, string[]>();
    for (const row of rows) {
      const list = map.get(row.event_id) ?? [];
      list.push(row.photo_url);
      map.set(row.event_id, list);
    }
    return map;
  }

  async findContributionsByEventIds(eventIds: number[]): Promise<Map<number, ContributionRow[]>> {
    if (eventIds.length === 0) {
      return new Map();
    }

    const rows = await db(`${Tables.EVENT_CONTRIBUTIONS} as c`)
      .innerJoin(`${Tables.PERSONS} as p`, 'p.id', 'c.contributor_person_id')
      .whereIn('c.event_id', eventIds)
      .orderBy('c.created_at', 'desc')
      .select<ContributionRow[]>(
        'c.id',
        'c.event_id',
        'c.contributor_person_id',
        'c.photo_url',
        'c.caption',
        'c.created_at',
        db.raw('p.full_name as contributor_name'),
      );

    const map = new Map<number, ContributionRow[]>();
    for (const row of rows) {
      const list = map.get(row.event_id) ?? [];
      list.push(row);
      map.set(row.event_id, list);
    }
    return map;
  }

  async create(
    familyId: number,
    createdByPersonId: number,
    input: UpsertEventInput,
  ): Promise<number> {
    return db.transaction(async (trx) => {
      const [eventId] = await trx(Tables.EVENTS).insert({
        family_id: familyId,
        title: input.title,
        type: input.type,
        date: input.date,
        end_date: input.endDate ?? null,
        location: input.location ?? null,
        description: input.description ?? null,
        created_by_person_id: createdByPersonId,
      });

      const id = Number(eventId);
      await this.syncPersons(trx, id, input.personIds ?? []);
      await this.syncAttendees(trx, id, input.attendeeIds ?? []);
      await this.syncPhotos(trx, id, input.photoUrls ?? []);
      return id;
    });
  }

  async update(familyId: number, eventId: number, input: UpsertEventInput): Promise<void> {
    await db.transaction(async (trx) => {
      await trx(Tables.EVENTS)
        .where({ id: eventId, family_id: familyId })
        .whereNull('deleted_at')
        .update({
          title: input.title,
          type: input.type,
          date: input.date,
          end_date: input.endDate ?? null,
          location: input.location ?? null,
          description: input.description ?? null,
          updated_at: trx.fn.now(),
        });

      await this.syncPersons(trx, eventId, input.personIds ?? []);
      await this.syncAttendees(trx, eventId, input.attendeeIds ?? []);
      await this.syncPhotos(trx, eventId, input.photoUrls ?? []);
    });
  }

  async softDelete(familyId: number, eventId: number): Promise<void> {
    await db(Tables.EVENTS)
      .where({ id: eventId, family_id: familyId })
      .whereNull('deleted_at')
      .update({ deleted_at: db.fn.now() });
  }

  async insertContribution(
    eventId: number,
    contributorPersonId: number,
    photoUrl: string,
    caption: string | null,
  ): Promise<number> {
    const [id] = await db(Tables.EVENT_CONTRIBUTIONS).insert({
      event_id: eventId,
      contributor_person_id: contributorPersonId,
      photo_url: photoUrl,
      caption,
    });
    return Number(id);
  }

  private async syncPersons(trx: typeof db, eventId: number, personIds: number[]): Promise<void> {
    await trx(Tables.EVENT_PERSONS).where({ event_id: eventId }).del();
    const unique = [...new Set(personIds)];
    if (unique.length === 0) {
      return;
    }
    await trx(Tables.EVENT_PERSONS).insert(
      unique.map((personId) => ({ event_id: eventId, person_id: personId })),
    );
  }

  private async syncAttendees(trx: typeof db, eventId: number, attendeeIds: number[]): Promise<void> {
    await trx(Tables.EVENT_ATTENDEES).where({ event_id: eventId }).del();
    const unique = [...new Set(attendeeIds)];
    if (unique.length === 0) {
      return;
    }
    await trx(Tables.EVENT_ATTENDEES).insert(
      unique.map((personId) => ({ event_id: eventId, person_id: personId })),
    );
  }

  private async syncPhotos(trx: typeof db, eventId: number, photoUrls: string[]): Promise<void> {
    await trx(Tables.EVENT_PHOTOS).where({ event_id: eventId }).del();
    if (photoUrls.length === 0) {
      return;
    }
    await trx(Tables.EVENT_PHOTOS).insert(
      photoUrls.map((photoUrl, index) => ({
        event_id: eventId,
        photo_url: photoUrl,
        sort_order: index,
      })),
    );
  }
}

export const eventsRepository = new EventsRepository();
