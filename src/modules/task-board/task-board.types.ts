export type TaskType = 'Bugfixing' | 'Feature' | 'Refactor';

/** Status task. "Done" dibuang — status terakhir task adalah "Merged". */
export type TaskStatus = 'To-Do' | 'In Progress' | 'Merged';

export type LinkType = 'discord' | 'notion' | 'mr';

/** Jenis pekerjaan tempat kerja. */
export type EmploymentType =
  | 'Fulltime'
  | 'Freelance'
  | 'Part-time'
  | 'Contract'
  | 'Personal';

export interface TaskLink {
  id?: number;
  type: LinkType;
  url: string;
}

export interface TaskImage {
  id?: number;
  url: string;
}

/** Satu entri deskripsi task (banyak entri per task). */
export interface TaskDescription {
  id?: number;
  title: string;
  content: string;
  /** Posisi urutan manual (0 = paling atas). */
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

/** Checklist (todo) di dalam sebuah task. 1 task → banyak todo. */
export interface TaskTodo {
  id: number;
  task_id: number;
  title: string;
  /** HTML dari editor (boleh kosong). */
  description: string;
  is_done: boolean;
  /** Posisi urutan manual (0 = paling atas). */
  sort_order?: number;
  created_at: string;
  updated_at: string;
}

export interface TaskTodoCreateInput {
  title: string;
  description?: string;
}

export interface TaskTodoUpdateInput {
  title?: string;
  description?: string;
  is_done?: boolean;
}

/**
 * Tempat kerja / kantor yang menaungi task. Dimiliki per `person_id`
 * (owner-scoped) dan bisa diarsipkan (soft delete).
 */
export interface Workplace {
  id: number;
  person_id: number;
  name: string;
  employment_type: EmploymentType;
  role: string | null;
  location: string | null;
  /** Kunci warna aksen (mis. `amber`, `sky`). */
  accent: string | null;
  started_at: string | null;
  ended_at: string | null;
  /** Tempat kerja bawaan untuk task lama yang belum punya kantor. */
  is_default: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkplaceCreateInput {
  name: string;
  employment_type: EmploymentType;
  role?: string | null;
  location?: string | null;
  accent?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
}

export type WorkplaceUpdateInput = Partial<WorkplaceCreateInput>;

/**
 * Jenis aksi di riwayat task.
 *
 * - `created` — task dibuat (entri pertama).
 * - `status_changed` — status berubah (mis. ke `Merged`).
 * - `description_added` / `description_updated` / `description_removed` —
 *   deskripsi ditambah/diubah/dihapus.
 * - `revision_created` — task ini dibuat sebagai revisi. Entri ditulis di
 *   history task INDUK, `related_task_id` menunjuk task anak (revisi) ini.
 */
export type TaskHistoryAction =
  | 'created'
  | 'status_changed'
  | 'description_added'
  | 'description_updated'
  | 'description_removed'
  | 'revision_created';

/** Satu entri riwayat task: aksi + status saat kejadian, plus notes opsional. */
export interface TaskHistoryEntry {
  id: number;
  action: TaskHistoryAction;
  status: string;
  notes: string | null;
  /**
   * Task terkait aksi ini. Terisi hanya untuk `revision_created` (id task
   * anak/revisi) supaya FE bisa menautkannya ke detail child. Selain itu `null`.
   * Menjadi `null` juga kalau task terkait sudah dihapus (FK ON DELETE SET NULL).
   */
  related_task_id: number | null;
  /** Judul task terkait (join `tb_tasks`), untuk label link tanpa request tambahan. */
  related_task_title: string | null;
  changed_at: string;
}

export interface Task {
  id: number;
  person_id: number;
  type: TaskType;
  title: string;
  branch_name: string;
  status: TaskStatus;
  /** Deskripsi task (judul + isi), minimal satu entri saat create. */
  descriptions: TaskDescription[];
  /**
   * Field lama (string tunggal). Diisi dari deskripsi pertama supaya klien
   * lama tetap jalan selama masa transisi.
   */
  description: string | null;
  deploy_notes: string | null;
  /** Nama file migration yang ikut di task ini. */
  migration_files: string[];
  /** Kalau terisi, task ini revisi dari task tersebut. */
  parent_task_id: number | null;
  /** Tempat kerja pemilik task. `null` = belum ditentukan. */
  workplace_id: number | null;
  /** Posisi urutan manual pada list (0 = paling atas). */
  sort_order: number;
  links: TaskLink[];
  images: TaskImage[];
  /** Terisi di GET /tasks/:id kalau task ini revisi. */
  parent_task?: Task | null;
  /** Terisi di GET /tasks/:id kalau task ini punya revisi. */
  revisions?: Task[];
  /** Riwayat aksi task (status, deskripsi, revisi — terbaru lebih dulu). */
  history?: TaskHistoryEntry[];
  /** Checklist todo task. Terisi di GET /tasks/:id (dan endpoint /todos). */
  todos?: TaskTodo[];
  created_at: string;
  updated_at: string;
}

export interface TaskDescriptionInput {
  id?: number;
  title: string;
  content: string;
}

export interface TaskCreateInput {
  type: TaskType;
  title: string;
  branch_name: string;
  status: TaskStatus;
  links?: TaskLink[];
  descriptions?: TaskDescriptionInput[];
  deploy_notes?: string;
  migration_files?: string[];
  parent_task_id?: number | null;
  workplace_id?: number | null;
  /** Notes untuk entri history pertama. */
  status_notes?: string;
}

export interface TaskUpdateInput {
  type?: TaskType;
  title?: string;
  branch_name?: string;
  status?: TaskStatus;
  links?: TaskLink[];
  descriptions?: TaskDescriptionInput[];
  deploy_notes?: string;
  migration_files?: string[];
  parent_task_id?: number | null;
  workplace_id?: number | null;
  /** Notes yang ikut disimpan di history saat status berubah. */
  status_notes?: string;
}

export interface TaskListQuery {
  type?: TaskType;
  status?: TaskStatus;
  search?: string;
  workplace_id?: number;
}
