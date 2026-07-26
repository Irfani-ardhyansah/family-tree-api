/**
 * Path navigasi FE untuk `POST /api/v1/logs/events` (`page.view` / `click`).
 * Gunakan path router FE — bukan path API.
 */
export const NAVIGATION_PAGE_PATHS = {
  LOGIN: '/login',
  TREE: '/tree',
  PERSONS: '/persons',
  FAMILY_MAP: '/family/map',
  EVENTS: '/events',
  IN_MEMORIAM: '/in-memoriam',
} as const;

const NAVIGATION_PATH_PREFIXES = [
  NAVIGATION_PAGE_PATHS.PERSONS,
  NAVIGATION_PAGE_PATHS.EVENTS,
  NAVIGATION_PAGE_PATHS.IN_MEMORIAM,
] as const;

/** Normalisasi path: tanpa query, tanpa trailing slash (kecuali root). */
export function normalizeNavigationPath(path: string): string {
  const withoutQuery = path.split('?')[0]?.trim() ?? '';
  if (withoutQuery === '/' || withoutQuery === '') {
    return '/';
  }
  return withoutQuery.replace(/\/+$/, '');
}

/**
 * Validasi path navigasi FE.
 * Exact match untuk halaman utama; prefix untuk sub-rute (mis. `/in-memoriam/17`).
 */
export function isAllowedNavigationPath(path: string): boolean {
  const normalized = normalizeNavigationPath(path);

  const exactPaths = new Set<string>(Object.values(NAVIGATION_PAGE_PATHS));
  if (exactPaths.has(normalized)) {
    return true;
  }

  for (const prefix of NAVIGATION_PATH_PREFIXES) {
    if (normalized.startsWith(`${prefix}/`)) {
      return true;
    }
  }

  return false;
}

export const NAVIGATION_PAGE_LABELS: Record<string, string> = {
  [NAVIGATION_PAGE_PATHS.LOGIN]: 'Login',
  [NAVIGATION_PAGE_PATHS.TREE]: 'Family Tree',
  [NAVIGATION_PAGE_PATHS.PERSONS]: 'Data Keluarga',
  [NAVIGATION_PAGE_PATHS.FAMILY_MAP]: 'Peta Keluarga',
  [NAVIGATION_PAGE_PATHS.EVENTS]: 'Acara',
  [NAVIGATION_PAGE_PATHS.IN_MEMORIAM]: 'In Memoriam',
};
