import type { TaskDescriptionInput } from './task-board.types';

/** Baris deskripsi lama dari `tb_task_descriptions` (untuk di-diff). */
export interface DescriptionSnapshot {
  id: number;
  title: string;
  content: string;
}

/** Hasil diff deskripsi lama vs payload `descriptions` dari PUT. */
export interface DescriptionDiff {
  /** Entri baru: tanpa `id`, atau `id` yang bukan milik task ini. */
  added: TaskDescriptionInput[];
  /** Entri dipertahankan tapi judul/isi-nya berubah. */
  updated: TaskDescriptionInput[];
  /** Entri lama yang tidak dikirim lagi → dihapus. */
  removed: DescriptionSnapshot[];
  /** `id` lama yang masih dikirim — di-update, bukan insert. */
  keptIds: Set<number>;
}

/**
 * Diff deskripsi mengikuti aturan PUT `descriptions`: entri dengan `id` milik
 * task → dipertahankan, tanpa `id` → baru, entri lama yang tidak dikirim →
 * dihapus. Judul + isi sama persis tidak dihitung `updated`, supaya tidak
 * menulis entri history yang tidak perlu.
 */
export function diffDescriptions(
  existing: DescriptionSnapshot[],
  incoming: TaskDescriptionInput[],
): DescriptionDiff {
  const existingById = new Map(existing.map((row) => [row.id, row]));
  const added: TaskDescriptionInput[] = [];
  const updated: TaskDescriptionInput[] = [];
  const keptIds = new Set<number>();

  for (const entry of incoming) {
    const current = typeof entry.id === 'number' ? existingById.get(entry.id) : undefined;

    if (!current) {
      added.push(entry);
      continue;
    }

    keptIds.add(current.id);
    if (current.title !== entry.title || current.content !== entry.content) {
      updated.push(entry);
    }
  }

  return {
    added,
    updated,
    removed: existing.filter((row) => !keptIds.has(row.id)),
    keptIds,
  };
}
