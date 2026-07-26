import { PersonAddress } from '../persons.types';

export type PersonImportJobStatus =
  | 'queued'
  | 'validating'
  | 'importing'
  | 'completed'
  | 'failed';

export type PersonImportFormat = 'csv' | 'json';

export type PersonImportRowInput = {
  tempId: string;
  fullName: string;
  nickname?: string | null;
  gender: 'male' | 'female';
  birthDate: string;
  deathDate?: string | null;
  status?: 'alive' | 'deceased';
  religion?: 'islam' | 'other' | null;
  occupation?: string | null;
  phone?: string | null;
  phoneAlt?: string | null;
  address?: PersonAddress | null;
  fatherTempId?: string | null;
  motherTempId?: string | null;
  spouseTempIds?: string[];
  fatherId?: number | null;
  motherId?: number | null;
  spouseIds?: number[];
  role?: 'admin' | 'member';
};

/** Normalized row stored in job.payload */
export type PersonImportNormalizedRow = {
  row: number;
  tempId: string;
  fullName: string;
  nickname: string | null;
  gender: 'male' | 'female';
  birthDate: string;
  deathDate: string | null;
  status: 'alive' | 'deceased';
  religion: 'islam' | 'other' | null;
  occupation: string | null;
  phone: string | null;
  phoneAlt: string | null;
  address: PersonAddress | null;
  fatherTempId: string | null;
  motherTempId: string | null;
  spouseTempIds: string[];
  fatherId: number | null;
  motherId: number | null;
  spouseIds: number[];
  role: 'admin' | 'member';
};

export type PersonImportError = {
  row: number;
  tempId?: string;
  field?: string;
  message: string;
};

export type PersonImportPreviewItem = {
  tempId: string;
  fullName: string;
  gender: 'male' | 'female';
  birthDate: string;
  fatherTempId: string | null;
  motherTempId: string | null;
  spouseTempIds: string[];
  fatherId: number | null;
  motherId: number | null;
  spouseIds: number[];
};

export type PersonImportJobResult = {
  dryRun: boolean;
  rowCount: number;
  createdCount: number;
  idByTempId: Record<string, number>;
  preview: PersonImportPreviewItem[];
  persons: Array<{
    id: number;
    tempId: string;
    fullName: string;
    fatherId: number | null;
    motherId: number | null;
    spouseIds: number[];
  }>;
};

export type PersonImportJobRow = {
  id: string;
  family_id: number;
  created_by_person_id: number;
  dry_run: boolean | number;
  format: PersonImportFormat;
  status: PersonImportJobStatus;
  progress_percent: number;
  processed: number;
  total: number;
  message: string | null;
  payload: PersonImportNormalizedRow[] | string;
  errors: PersonImportError[] | string | null;
  result: PersonImportJobResult | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  started_at: Date | string | null;
  finished_at: Date | string | null;
};

export type PersonImportJobResponse = {
  jobId: string;
  status: PersonImportJobStatus;
  dryRun: boolean;
  format: PersonImportFormat;
  progress: {
    percent: number;
    processed: number;
    total: number;
  };
  message: string | null;
  errors: PersonImportError[];
  result: PersonImportJobResult | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};
