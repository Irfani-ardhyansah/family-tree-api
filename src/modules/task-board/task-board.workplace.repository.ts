import db from '../../config/database';
import { Tables } from '../../shared/database/tables';
import type {
  EmploymentType,
  Workplace,
  WorkplaceCreateInput,
  WorkplaceUpdateInput,
} from './task-board.types';

interface WorkplaceRow {
  id: number;
  person_id: number;
  name: string;
  employment_type: EmploymentType;
  role: string | null;
  location: string | null;
  accent: string | null;
  started_at: string | null;
  ended_at: string | null;
  is_default: boolean | number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

function toWorkplace(row: WorkplaceRow): Workplace {
  return {
    id: row.id,
    person_id: row.person_id,
    name: row.name,
    employment_type: row.employment_type,
    role: row.role,
    location: row.location,
    accent: row.accent,
    started_at: row.started_at,
    ended_at: row.ended_at,
    is_default: row.is_default === true || row.is_default === 1,
    archived_at: row.archived_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class TaskBoardWorkplaceRepository {
  async list(personId: number): Promise<Workplace[]> {
    const rows = await db(Tables.TB_WORKPLACES)
      .where({ person_id: personId })
      .orderBy('is_default', 'desc')
      .orderByRaw('archived_at IS NULL DESC')
      .orderBy('id', 'asc')
      .select<WorkplaceRow[]>('*');
    return rows.map(toWorkplace);
  }

  async findById(
    personId: number,
    workplaceId: number,
  ): Promise<Workplace | undefined> {
    if (!Number.isInteger(workplaceId)) return undefined;
    const row = await db(Tables.TB_WORKPLACES)
      .where({ id: workplaceId, person_id: personId })
      .first<WorkplaceRow>('*');
    return row ? toWorkplace(row) : undefined;
  }

  /** Jumlah task yang masih memakai workplace ini (untuk validasi hapus). */
  async countTasks(personId: number, workplaceId: number): Promise<number> {
    const [row] = await db(Tables.TB_TASKS)
      .where({ person_id: personId, workplace_id: workplaceId })
      .count<Array<{ total: number | string }>>({ total: '*' });
    return Number(row?.total ?? 0);
  }

  async create(
    personId: number,
    input: WorkplaceCreateInput,
  ): Promise<Workplace> {
    const [insertedId] = await db(Tables.TB_WORKPLACES).insert({
      person_id: personId,
      name: input.name,
      employment_type: input.employment_type,
      role: input.role ?? null,
      location: input.location ?? null,
      accent: input.accent ?? null,
      started_at: input.started_at ?? null,
      ended_at: input.ended_at ?? null,
      is_default: false,
    });

    const created = await this.findById(personId, insertedId as number);
    return created!;
  }

  async update(
    personId: number,
    workplaceId: number,
    input: WorkplaceUpdateInput,
  ): Promise<Workplace | undefined> {
    const existing = await this.findById(personId, workplaceId);
    if (!existing) return undefined;

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.employment_type !== undefined) {
      updateData.employment_type = input.employment_type;
    }
    if (input.role !== undefined) updateData.role = input.role;
    if (input.location !== undefined) updateData.location = input.location;
    if (input.accent !== undefined) updateData.accent = input.accent;
    if (input.started_at !== undefined) updateData.started_at = input.started_at;
    if (input.ended_at !== undefined) updateData.ended_at = input.ended_at;

    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = db.fn.now();
      await db(Tables.TB_WORKPLACES)
        .where({ id: workplaceId, person_id: personId })
        .update(updateData);
    }

    return this.findById(personId, workplaceId);
  }

  async setArchived(
    personId: number,
    workplaceId: number,
    archived: boolean,
  ): Promise<Workplace | undefined> {
    const existing = await this.findById(personId, workplaceId);
    if (!existing) return undefined;

    await db(Tables.TB_WORKPLACES)
      .where({ id: workplaceId, person_id: personId })
      .update({
        archived_at: archived ? db.fn.now() : null,
        updated_at: db.fn.now(),
      });

    return this.findById(personId, workplaceId);
  }

  async delete(personId: number, workplaceId: number): Promise<boolean> {
    const deleted = await db(Tables.TB_WORKPLACES)
      .where({ id: workplaceId, person_id: personId })
      .del();
    return deleted > 0;
  }
}

export const taskBoardWorkplaceRepository =
  new TaskBoardWorkplaceRepository();
