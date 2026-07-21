import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import { TreeLineage, TreeSubgraphFilter } from './persons.types';

export const TREE_FILTER_PARAM_KEYS = [
  'lineage',
  'generationsUp',
  'showSpouses',
  'showSiblings',
  'showChildren',
] as const;

export const TREE_FILTER_DEFAULTS: TreeSubgraphFilter = {
  lineage: 'both',
  generationsUp: 4,
  showSpouses: false,
  showSiblings: false,
  showChildren: false,
};

export const MAX_GENERATIONS_UP = 12;
export const CLIENT_FILTER_RECOMMEND_THRESHOLD = 200;

const LINEAGE_VALUES: TreeLineage[] = ['both', 'paternal', 'maternal'];

function singleQueryValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function parseBooleanParam(raw: unknown, paramName: string): boolean {
  const value = singleQueryValue(raw);
  if (value === undefined) {
    throw new AppError(
      400,
      ErrorCodes.TREE_FILTER_INVALID,
      `Parameter ${paramName} tidak valid.`,
    );
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'false' || normalized === '0') {
    return false;
  }

  throw new AppError(
    400,
    ErrorCodes.TREE_FILTER_INVALID,
    `Parameter ${paramName} harus true atau false.`,
  );
}

function parseLineage(raw: unknown): TreeLineage {
  const value = String(singleQueryValue(raw)).trim().toLowerCase();
  if (LINEAGE_VALUES.includes(value as TreeLineage)) {
    return value as TreeLineage;
  }

  throw new AppError(
    400,
    ErrorCodes.TREE_FILTER_INVALID,
    'Parameter lineage harus both, paternal, atau maternal.',
  );
}

function parseGenerationsUp(raw: unknown): number {
  const value = Number(singleQueryValue(raw));
  if (!Number.isInteger(value) || value < 1 || value > MAX_GENERATIONS_UP) {
    throw new AppError(
      400,
      ErrorCodes.TREE_FILTER_INVALID,
      `Parameter generationsUp harus integer 1–${MAX_GENERATIONS_UP}.`,
    );
  }
  return value;
}

export function hasTreeFilterParams(raw: Record<string, unknown>): boolean {
  return TREE_FILTER_PARAM_KEYS.some((key) => raw[key] !== undefined);
}

export function parseTreeFilterQuery(raw: Record<string, unknown>): {
  filter: TreeSubgraphFilter;
  applied: boolean;
} {
  if (!hasTreeFilterParams(raw)) {
    return { filter: { ...TREE_FILTER_DEFAULTS }, applied: false };
  }

  const filter: TreeSubgraphFilter = { ...TREE_FILTER_DEFAULTS };

  if (raw.lineage !== undefined) {
    filter.lineage = parseLineage(raw.lineage);
  }
  if (raw.generationsUp !== undefined) {
    filter.generationsUp = parseGenerationsUp(raw.generationsUp);
  }
  if (raw.showSpouses !== undefined) {
    filter.showSpouses = parseBooleanParam(raw.showSpouses, 'showSpouses');
  }
  if (raw.showSiblings !== undefined) {
    filter.showSiblings = parseBooleanParam(raw.showSiblings, 'showSiblings');
  }
  if (raw.showChildren !== undefined) {
    filter.showChildren = parseBooleanParam(raw.showChildren, 'showChildren');
  }

  return { filter, applied: true };
}
