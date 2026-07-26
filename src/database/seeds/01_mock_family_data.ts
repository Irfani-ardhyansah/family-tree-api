import fs from 'fs';
import path from 'path';
import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

type SeedAddress = {
  street?: string | null;
  district?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type SeedPerson = {
  id: string;
  fullName: string;
  nickname?: string | null;
  gender: 'male' | 'female';
  birthDate: string;
  deathDate?: string | null;
  status: 'alive' | 'deceased';
  religion?: 'islam' | 'other' | null;
  photoUrl?: string | null;
  occupation?: string | null;
  phone?: string | null;
  phoneAlt?: string | null;
  address?: SeedAddress | null;
  fatherId?: string | null;
  motherId?: string | null;
  spouseIds?: string[];
  generationLabel?: string | null;
  isSelf?: boolean;
  role?: 'admin' | 'member' | null;
};

type SeedSpousePair = {
  personIdA: string;
  personIdB: string;
};

type SeedPayload = {
  meta: {
    familyId: string;
    familyName: string;
    rootPersonId: string;
    totalPersons: number;
    alive: number;
    deceased: number;
  };
  persons: SeedPerson[];
  spouses: SeedSpousePair[];
};

function loadSeedPayload(): SeedPayload {
  const seedPath = path.resolve(__dirname, '../../../docs/reference/seed/mock-family-seed.json');
  const raw = fs.readFileSync(seedPath, 'utf8');
  return JSON.parse(raw) as SeedPayload;
}

function buildSlugToIdMap(persons: SeedPerson[]): Map<string, number> {
  const map = new Map<string, number>();
  persons.forEach((person, index) => {
    map.set(person.id, index + 1);
  });
  return map;
}

function resolveId(map: Map<string, number>, slug: string | null | undefined): number | null {
  if (!slug) {
    return null;
  }
  const id = map.get(slug);
  if (id === undefined) {
    throw new Error(`Seed mapping failed: unknown slug "${slug}"`);
  }
  return id;
}

function canonicalSpousePair(idA: number, idB: number): { person_id_a: number; person_id_b: number } {
  return idA < idB
    ? { person_id_a: idA, person_id_b: idB }
    : { person_id_a: idB, person_id_b: idA };
}

function hasPersonDetails(person: SeedPerson): boolean {
  return Boolean(
    person.religion ||
      person.photoUrl ||
      person.occupation ||
      person.phone ||
      person.phoneAlt,
  );
}

export async function seed(knex: Knex): Promise<void> {
  const payload = loadSeedPayload();
  const { meta, persons, spouses } = payload;
  const slugToId = buildSlugToIdMap(persons);
  const familyId = 1;

  await knex(Tables.PERSON_SPOUSES).del();
  await knex(Tables.PERSON_ADDRESSES).del();
  await knex(Tables.PERSON_LINEAGE).del();
  await knex(Tables.PERSON_DETAILS).del();
  await knex(Tables.FAMILY_MEMBERS).del();
  await knex(Tables.PERSONS).del();
  await knex(Tables.FAMILIES).del();

  await knex(Tables.FAMILIES).insert({
    id: familyId,
    name: meta.familyName,
    root_person_id: null,
  });

  const personRows = persons.map((person) => ({
    id: slugToId.get(person.id),
    family_id: familyId,
    full_name: person.fullName,
    nickname: person.nickname ?? null,
    gender: person.gender,
    birth_date: person.birthDate,
    death_date: person.deathDate ?? null,
    status: person.status,
    deleted_at: null,
  }));

  const lineageRows = persons
    .filter((person) => person.fatherId || person.motherId)
    .map((person) => ({
      person_id: slugToId.get(person.id)!,
      father_id: resolveId(slugToId, person.fatherId),
      mother_id: resolveId(slugToId, person.motherId),
    }));

  const detailRows = persons.filter(hasPersonDetails).map((person) => ({
    person_id: slugToId.get(person.id)!,
    religion: person.religion ?? null,
    photo_url: person.photoUrl ?? null,
    occupation: person.occupation ?? null,
    phone: person.phone ?? null,
    phone_alt: person.phoneAlt ?? null,
  }));

  const addressRows = persons
    .filter((person) => person.address)
    .map((person) => ({
      person_id: slugToId.get(person.id)!,
      street: person.address?.street ?? null,
      district: person.address?.district ?? null,
      city: person.address?.city ?? null,
      province: person.address?.province ?? null,
      postal_code: person.address?.postalCode ?? null,
      country: person.address?.country ?? null,
      latitude: person.address?.latitude ?? null,
      longitude: person.address?.longitude ?? null,
    }));

  const memberRows = persons.map((person) => ({
    family_id: familyId,
    person_id: slugToId.get(person.id)!,
    role: person.role === 'admin' ? 'admin' : 'member',
  }));

  const chunkSize = 25;
  for (let i = 0; i < personRows.length; i += chunkSize) {
    await knex(Tables.PERSONS).insert(personRows.slice(i, i + chunkSize));
  }

  if (lineageRows.length > 0) {
    for (let i = 0; i < lineageRows.length; i += chunkSize) {
      await knex(Tables.PERSON_LINEAGE).insert(lineageRows.slice(i, i + chunkSize));
    }
  }

  if (detailRows.length > 0) {
    for (let i = 0; i < detailRows.length; i += chunkSize) {
      await knex(Tables.PERSON_DETAILS).insert(detailRows.slice(i, i + chunkSize));
    }
  }

  if (addressRows.length > 0) {
    await knex(Tables.PERSON_ADDRESSES).insert(addressRows);
  }

  for (let i = 0; i < memberRows.length; i += chunkSize) {
    await knex(Tables.FAMILY_MEMBERS).insert(memberRows.slice(i, i + chunkSize));
  }

  const spouseRows = spouses.map((pair) =>
    canonicalSpousePair(
      slugToId.get(pair.personIdA)!,
      slugToId.get(pair.personIdB)!,
    ),
  );
  for (let i = 0; i < spouseRows.length; i += chunkSize) {
    await knex(Tables.PERSON_SPOUSES).insert(spouseRows.slice(i, i + chunkSize));
  }

  const rootPersonId = resolveId(slugToId, meta.rootPersonId);
  await knex(Tables.FAMILIES).where({ id: familyId }).update({
    root_person_id: rootPersonId,
  });

  const total = Number((await knex(Tables.PERSONS).count({ count: '*' }))[0]?.count ?? 0);
  const alive = Number(
    (await knex(Tables.PERSONS).where({ status: 'alive' }).count({ count: '*' }))[0]?.count ?? 0,
  );
  const deceased = Number(
    (await knex(Tables.PERSONS).where({ status: 'deceased' }).count({ count: '*' }))[0]?.count ?? 0,
  );
  const spouseCount = Number((await knex(Tables.PERSON_SPOUSES).count({ count: '*' }))[0]?.count ?? 0);
  const adminCount = Number(
    (await knex(Tables.FAMILY_MEMBERS).where({ role: 'admin' }).count({ count: '*' }))[0]?.count ?? 0,
  );
  const detailCount = Number((await knex(Tables.PERSON_DETAILS).count({ count: '*' }))[0]?.count ?? 0);
  const addressCount = Number((await knex(Tables.PERSON_ADDRESSES).count({ count: '*' }))[0]?.count ?? 0);
  const lineageCount = Number((await knex(Tables.PERSON_LINEAGE).count({ count: '*' }))[0]?.count ?? 0);

  if (total !== meta.totalPersons) {
    throw new Error(`Seed validation failed: expected ${meta.totalPersons} persons, got ${total}`);
  }
  if (alive !== meta.alive) {
    throw new Error(`Seed validation failed: expected ${meta.alive} alive, got ${alive}`);
  }
  if (deceased !== meta.deceased) {
    throw new Error(`Seed validation failed: expected ${meta.deceased} deceased, got ${deceased}`);
  }
  if (spouseCount !== spouses.length) {
    throw new Error(
      `Seed validation failed: expected ${spouses.length} canonical spouse rows, got ${spouseCount}`,
    );
  }
  if (adminCount !== 1) {
    throw new Error(`Seed validation failed: expected 1 admin (me / Irfani), got ${adminCount}`);
  }

  const demoMrId = slugToId.get('demo-mr');
  const meId = slugToId.get('me');
  const fatherId = slugToId.get('father');

  console.log(
    `Seed OK: persons=${total}, alive=${alive}, deceased=${deceased}, spouses=${spouseCount}, lineage=${lineageCount}, details=${detailCount}, addresses=${addressCount}, admins=${adminCount}`,
  );
  console.log(`familyId=${familyId}, rootPersonId=${rootPersonId} (slug: ${meta.rootPersonId})`);
  console.log(`slug map: demo-mr=${demoMrId}, me=${meId}, father=${fatherId}`);
  console.log('generationLabel + isSelf are derived at API from logged-in personId');
  console.log('Login code smoke (derived): demo-mr=MR170845, me=MIA210399, father=BA200175');
}
