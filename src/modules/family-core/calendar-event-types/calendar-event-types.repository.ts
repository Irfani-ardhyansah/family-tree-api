import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import { SEED_CALENDAR_EVENT_TYPES } from '../fc.constants';
import type { FcCalendarEventTypeRow } from '../fc.types';

export class CalendarEventTypesRepository {
  async ensureSystemTypes(familyId: number): Promise<void> {
    const existing = await db(Tables.FC_CALENDAR_EVENT_TYPES)
      .where({ family_id: familyId, is_system: true })
      .select<{ slug: string }[]>('slug');
    const have = new Set(existing.map((r) => r.slug));
    const missing = SEED_CALENDAR_EVENT_TYPES.filter((t) => !have.has(t.slug));
    if (missing.length === 0) return;

    await db(Tables.FC_CALENDAR_EVENT_TYPES).insert(
      missing.map((t) => ({
        family_id: familyId,
        slug: t.slug,
        label: t.label,
        icon_key: t.icon_key,
        tone_key: t.tone_key,
        links_to_health: t.links_to_health,
        is_system: true,
        sort_order: t.sort_order,
      })),
    );
  }

  async list(familyId: number): Promise<FcCalendarEventTypeRow[]> {
    return db(Tables.FC_CALENDAR_EVENT_TYPES)
      .where({ family_id: familyId })
      .orderBy('sort_order', 'asc')
      .orderBy('id', 'asc')
      .select<FcCalendarEventTypeRow[]>('*');
  }

  async findById(
    familyId: number,
    id: number,
  ): Promise<FcCalendarEventTypeRow | undefined> {
    return db(Tables.FC_CALENDAR_EVENT_TYPES)
      .where({ id, family_id: familyId })
      .first<FcCalendarEventTypeRow>('*');
  }

  async create(input: {
    familyId: number;
    slug: string;
    label: string;
    iconKey: string;
    toneKey: string;
    linksToHealth: boolean;
    sortOrder: number;
  }): Promise<FcCalendarEventTypeRow> {
    const [id] = await db(Tables.FC_CALENDAR_EVENT_TYPES).insert({
      family_id: input.familyId,
      slug: input.slug,
      label: input.label,
      icon_key: input.iconKey,
      tone_key: input.toneKey,
      links_to_health: input.linksToHealth,
      is_system: false,
      sort_order: input.sortOrder,
    });
    return (await this.findById(input.familyId, id))!;
  }

  async update(
    familyId: number,
    id: number,
    patch: Partial<{
      label: string;
      icon_key: string;
      tone_key: string;
      links_to_health: boolean;
      sort_order: number;
      slug: string;
    }>,
  ): Promise<void> {
    await db(Tables.FC_CALENDAR_EVENT_TYPES)
      .where({ id, family_id: familyId })
      .update({ ...patch, updated_at: db.fn.now() });
  }

  async remove(familyId: number, id: number): Promise<void> {
    await db(Tables.FC_CALENDAR_EVENT_TYPES).where({ id, family_id: familyId }).del();
  }

  /** Calendar events table not yet implemented — always 0. */
  async countEventsBySlug(_familyId: number, _slug: string): Promise<number> {
    return 0;
  }

  async maxSortOrder(familyId: number): Promise<number> {
    const row = await db(Tables.FC_CALENDAR_EVENT_TYPES)
      .where({ family_id: familyId })
      .max<{ max: number | string | null }>({ max: 'sort_order' })
      .first();
    return Number(row?.max ?? 0);
  }

  async slugExists(familyId: number, slug: string, excludeId?: number): Promise<boolean> {
    let q = db(Tables.FC_CALENDAR_EVENT_TYPES).where({ family_id: familyId, slug });
    if (excludeId != null) q = q.whereNot({ id: excludeId });
    const row = await q.first('id');
    return Boolean(row);
  }
}

export const calendarEventTypesRepository = new CalendarEventTypesRepository();
