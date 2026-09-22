import { env } from '../../config/env';
import { COUNTRY_NAMES } from './portfolio-analytics.constants';
import { GeoLookup } from './portfolio-analytics.types';

type MmdbCity = {
  country?: { iso_code?: string; names?: { en?: string } };
  registered_country?: { iso_code?: string; names?: { en?: string } };
  subdivisions?: Array<{ iso_code?: string; names?: { en?: string } }>;
  city?: { names?: { en?: string } };
};

type MmdbReader = { get: (ip: string) => MmdbCity | null };

const cache = new Map<string, { value: GeoLookup; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

let readerPromise: Promise<MmdbReader | null> | null = null;

function emptyGeo(): GeoLookup {
  return { countryCode: null, countryName: null, region: null, city: null };
}

function fromCountryCode(code: string | null | undefined, city?: string | null, region?: string | null): GeoLookup {
  const countryCode = code && /^[A-Z]{2}$/i.test(code) ? code.toUpperCase() : null;
  if (!countryCode || countryCode === 'XX' || countryCode === 'T1') {
    return emptyGeo();
  }
  return {
    countryCode,
    countryName: COUNTRY_NAMES[countryCode] ?? countryCode,
    region: region ?? null,
    city: city ?? null,
  };
}

async function getReader(): Promise<MmdbReader | null> {
  if (!env.analytics.geoipDbPath) {
    return null;
  }
  if (!readerPromise) {
    readerPromise = (async () => {
      try {
        // Optional dependency: `npm i maxmind` + GeoLite2 .mmdb at GEOIP_DB_PATH.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const maxmind = require('maxmind') as { open: (path: string) => Promise<MmdbReader> };
        return await maxmind.open(env.analytics.geoipDbPath);
      } catch {
        return null;
      }
    })();
  }
  return readerPromise;
}

export async function lookupGeo(ip: string | null, headerCountry?: string | null): Promise<GeoLookup> {
  if (headerCountry) {
    const fromHeader = fromCountryCode(headerCountry);
    if (fromHeader.countryCode) {
      return fromHeader;
    }
  }

  if (!ip || ip === 'unknown' || ip === '::1' || ip.startsWith('127.')) {
    return emptyGeo();
  }

  const cached = cache.get(ip);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const reader = await getReader();
  let value = emptyGeo();
  if (reader) {
    try {
      const city = reader.get(ip);
      value = fromCountryCode(
        city?.country?.iso_code ?? city?.registered_country?.iso_code,
        city?.city?.names?.en ?? null,
        city?.subdivisions?.[0]?.names?.en ?? city?.subdivisions?.[0]?.iso_code ?? null,
      );
      if (city?.country?.names?.en) {
        value = { ...value, countryName: city.country.names.en };
      }
    } catch {
      value = emptyGeo();
    }
  }

  cache.set(ip, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export function countryName(code: string | null | undefined): string | null {
  if (!code) {
    return null;
  }
  return COUNTRY_NAMES[code.toUpperCase()] ?? code.toUpperCase();
}
