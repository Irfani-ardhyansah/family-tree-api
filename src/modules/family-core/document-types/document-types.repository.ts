import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import { SEED_DOCUMENT_TYPES } from '../fc.constants';
import type { DocumentExtraFieldDef } from '../fc.constants';
import type { FcDocumentTypeRow } from '../fc.types';

export class DocumentTypesRepository {
  async ensureSystemTypes(familyId: number): Promise<void> {
    const existing = await db(Tables.FC_DOCUMENT_TYPES)
      .where({ family_id: familyId, is_system: true })
      .select<{ slug: string }[]>('slug');
    const have = new Set(existing.map((r) => r.slug));
    const missing = SEED_DOCUMENT_TYPES.filter((t) => !have.has(t.slug));
    if (missing.length === 0) return;

    await db(Tables.FC_DOCUMENT_TYPES).insert(
      missing.map((t) => ({
        family_id: familyId,
        slug: t.slug,
        label: t.label,
        icon_key: t.icon_key,
        tone_key: t.tone_key,
        extras: JSON.stringify(t.extras),
        default_lifetime: t.default_lifetime,
        allow_custom_title: t.allow_custom_title,
        is_system: true,
        sort_order: t.sort_order,
      })),
    );
  }

  async list(familyId: number): Promise<FcDocumentTypeRow[]> {
    return db(Tables.FC_DOCUMENT_TYPES)
      .where({ family_id: familyId })
      .orderBy('sort_order', 'asc')
      .orderBy('id', 'asc')
      .select<FcDocumentTypeRow[]>('*');
  }

  async findById(familyId: number, id: number): Promise<FcDocumentTypeRow | undefined> {
    return db(Tables.FC_DOCUMENT_TYPES)
      .where({ id, family_id: familyId })
      .first<FcDocumentTypeRow>('*');
  }

  async findBySlug(familyId: number, slug: string): Promise<FcDocumentTypeRow | undefined> {
    return db(Tables.FC_DOCUMENT_TYPES)
      .where({ family_id: familyId, slug })
      .first<FcDocumentTypeRow>('*');
  }

  async create(input: {
    familyId: number;
    slug: string;
    label: string;
    iconKey: string;
    toneKey: string;
    extras: DocumentExtraFieldDef[];
    defaultLifetime: boolean;
    allowCustomTitle: boolean;
    sortOrder: number;
  }): Promise<FcDocumentTypeRow> {
    const [id] = await db(Tables.FC_DOCUMENT_TYPES).insert({
      family_id: input.familyId,
      slug: input.slug,
      label: input.label,
      icon_key: input.iconKey,
      tone_key: input.toneKey,
      extras: JSON.stringify(input.extras),
      default_lifetime: input.defaultLifetime,
      allow_custom_title: input.allowCustomTitle,
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
      extras: string;
      default_lifetime: boolean;
      allow_custom_title: boolean;
      sort_order: number;
      slug: string;
    }>,
  ): Promise<void> {
    await db(Tables.FC_DOCUMENT_TYPES)
      .where({ id, family_id: familyId })
      .update({ ...patch, updated_at: db.fn.now() });
  }

  async remove(familyId: number, id: number): Promise<void> {
    await db(Tables.FC_DOCUMENT_TYPES).where({ id, family_id: familyId }).del();
  }

  async countDocumentsBySlug(familyId: number, slug: string): Promise<number> {
    const row = await db(Tables.FC_DOCUMENTS)
      .where({ family_id: familyId, document_type_slug: slug })
      .whereNull('deleted_at')
      .count<{ total: number | string }>({ total: '*' })
      .first();
    return Number(row?.total ?? 0);
  }

  async maxSortOrder(familyId: number): Promise<number> {
    const row = await db(Tables.FC_DOCUMENT_TYPES)
      .where({ family_id: familyId })
      .max<{ max: number | string | null }>({ max: 'sort_order' })
      .first();
    return Number(row?.max ?? 0);
  }

  async slugExists(familyId: number, slug: string, excludeId?: number): Promise<boolean> {
    let q = db(Tables.FC_DOCUMENT_TYPES).where({ family_id: familyId, slug });
    if (excludeId != null) q = q.whereNot({ id: excludeId });
    const row = await q.first('id');
    return Boolean(row);
  }
}

export const documentTypesRepository = new DocumentTypesRepository();
