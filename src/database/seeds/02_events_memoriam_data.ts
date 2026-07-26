import fs from 'fs';
import path from 'path';
import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

type SeedPerson = { id: string };

type SeedPayload = {
  persons: SeedPerson[];
};

function loadSlugToIdMap(): Map<string, number> {
  const seedPath = path.resolve(__dirname, '../../../docs/reference/seed/mock-family-seed.json');
  const payload = JSON.parse(fs.readFileSync(seedPath, 'utf8')) as SeedPayload;
  const map = new Map<string, number>();
  payload.persons.forEach((person, index) => {
    map.set(person.id, index + 1);
  });
  return map;
}

function id(map: Map<string, number>, slug: string): number {
  const value = map.get(slug);
  if (value === undefined) {
    throw new Error(`Unknown slug "${slug}" in events/memoriam seed`);
  }
  return value;
}

export async function seed(knex: Knex): Promise<void> {
  const slugToId = loadSlugToIdMap();
  const familyId = 1;

  await knex(Tables.MEMORIAM_PRAYERS).del();
  await knex(Tables.MEMORIAM_TRIBUTE_PHOTOS).del();
  await knex(Tables.MEMORIAM_TRIBUTES).del();
  await knex(Tables.EVENT_CONTRIBUTIONS).del();
  await knex(Tables.EVENT_PHOTOS).del();
  await knex(Tables.EVENT_ATTENDEES).del();
  await knex(Tables.EVENT_PERSONS).del();
  await knex(Tables.EVENTS).del();

  const meId = id(slugToId, 'me');
  const meSpId = id(slugToId, 'me-sp');
  const fatherId = id(slugToId, 'father');
  const patBuyutMId = id(slugToId, 'pat-buyut-m');
  const matBuyutMId = id(slugToId, 'mat-buyut-m');

  const [reunionId] = await knex(Tables.EVENTS).insert({
    family_id: familyId,
    title: 'Reuni Keluarga Besar 2024',
    type: 'reunion',
    date: '2024-12-25',
    end_date: '2024-12-26',
    location: 'Malang, Jawa Timur',
    description: 'Acara reuni tahunan seluruh keluarga.',
    created_by_person_id: meId,
  });

  const [weddingId] = await knex(Tables.EVENTS).insert({
    family_id: familyId,
    title: 'Pernikahan Irfani & Ayu',
    type: 'wedding',
    date: '2025-06-14',
    end_date: null,
    location: 'Masjid Al-Falah, Malang',
    description: 'Akad dan resepsi pernikahan.',
    created_by_person_id: meId,
  });

  const [birthdayId] = await knex(Tables.EVENTS).insert({
    family_id: familyId,
    title: 'Ulang Tahun Ayah',
    type: 'birthday',
    date: '2025-01-20',
    end_date: null,
    location: 'Rumah Jl. Diponegoro',
    description: null,
    created_by_person_id: fatherId,
  });

  const [restrictedMeId] = await knex(Tables.EVENTS).insert({
    family_id: familyId,
    title: 'Rapat Inti Keluarga (Restricted)',
    type: 'other',
    date: '2025-03-01',
    end_date: null,
    location: 'Private — hanya undangan',
    description: 'Acara restricted untuk uji EVENT_ACCESS_FORBIDDEN.',
    created_by_person_id: meId,
  });

  const [restrictedSpId] = await knex(Tables.EVENTS).insert({
    family_id: familyId,
    title: 'Arisan Keluarga Ayu (Restricted)',
    type: 'other',
    date: '2025-04-10',
    end_date: null,
    location: 'Rumah orang tua Ayu',
    description: 'Acara restricted di subgraph pasangan.',
    created_by_person_id: meSpId,
  });

  const [deathId] = await knex(Tables.EVENTS).insert({
    family_id: familyId,
    title: 'Tahlilan H. Ardhyansah',
    type: 'death',
    date: '1998-08-25',
    end_date: null,
    location: 'Desa asal, Malang',
    description: 'Mengenang almarhum buyut paternal.',
    created_by_person_id: fatherId,
  });

  await knex(Tables.EVENT_PERSONS).insert([
    { event_id: weddingId, person_id: meId },
    { event_id: weddingId, person_id: meSpId },
    { event_id: birthdayId, person_id: fatherId },
    { event_id: deathId, person_id: patBuyutMId },
    { event_id: restrictedSpId, person_id: meSpId },
    { event_id: restrictedSpId, person_id: id(slugToId, 'sp-father') },
  ]);

  await knex(Tables.EVENT_ATTENDEES).insert([
    { event_id: restrictedMeId, person_id: meId },
    { event_id: restrictedSpId, person_id: meSpId },
  ]);

  await knex(Tables.EVENT_PHOTOS).insert([
    {
      event_id: reunionId,
      photo_url: 'https://cdn.example.com/events/reunion-2024-cover.jpg',
      sort_order: 0,
    },
    {
      event_id: weddingId,
      photo_url: 'https://cdn.example.com/events/wedding-cover.jpg',
      sort_order: 0,
    },
  ]);

  await knex(Tables.EVENT_CONTRIBUTIONS).insert([
    {
      event_id: reunionId,
      contributor_person_id: meId,
      photo_url: 'https://cdn.example.com/events/reunion-group.jpg',
      caption: 'Foto bersama di halaman rumah',
    },
    {
      event_id: reunionId,
      contributor_person_id: fatherId,
      photo_url: 'https://cdn.example.com/events/reunion-food.jpg',
      caption: 'Meja makan keluarga',
    },
    {
      event_id: weddingId,
      contributor_person_id: meSpId,
      photo_url: 'https://cdn.example.com/events/wedding-akad.jpg',
      caption: 'Prosesi akad',
    },
  ]);

  const tributeContents = [
    '<p>Almarhum selalu mengajarkan <strong>kesabaran</strong> dan kejujuran.</p>',
    '<p>Doa kami senantiasa mengalir untuk Bapak.</p>',
    '<p>Terima kasih atas semua nasihat dan kasih sayang.</p>',
    '<p>Kenangan bersama di desa tidak akan pernah pudar.</p>',
  ];

  for (let i = 0; i < tributeContents.length; i += 1) {
    const [tributeId] = await knex(Tables.MEMORIAM_TRIBUTES).insert({
      family_id: familyId,
      deceased_person_id: patBuyutMId,
      author_person_id: i % 2 === 0 ? meId : fatherId,
      content: tributeContents[i],
    });

    if (i < 2) {
      await knex(Tables.MEMORIAM_TRIBUTE_PHOTOS).insert({
        tribute_id: tributeId,
        photo_url: `https://cdn.example.com/memoriam/pat-buyut-m-${i + 1}.jpg`,
        sort_order: 0,
      });
    }
  }

  for (let i = 0; i < 4; i += 1) {
    await knex(Tables.MEMORIAM_TRIBUTES).insert({
      family_id: familyId,
      deceased_person_id: matBuyutMId,
      author_person_id: i % 2 === 0 ? meId : id(slugToId, 'mother'),
      content: `<p>Kenangan almarhum H. Wijaya Kusuma — tribute ${i + 1}.</p>`,
    });
  }

  await knex(Tables.MEMORIAM_PRAYERS).insert([
    { family_id: familyId, deceased_person_id: patBuyutMId, author_person_id: meId },
    { family_id: familyId, deceased_person_id: patBuyutMId, author_person_id: fatherId },
    { family_id: familyId, deceased_person_id: patBuyutMId, author_person_id: id(slugToId, 'mother') },
    { family_id: familyId, deceased_person_id: patBuyutMId, author_person_id: meSpId },
    { family_id: familyId, deceased_person_id: patBuyutMId, author_person_id: id(slugToId, 'demo-mr') },
    { family_id: familyId, deceased_person_id: matBuyutMId, author_person_id: meId },
  ]);

  const eventCount = Number((await knex(Tables.EVENTS).count({ count: '*' }))[0]?.count ?? 0);
  const tributeCount = Number((await knex(Tables.MEMORIAM_TRIBUTES).count({ count: '*' }))[0]?.count ?? 0);
  const prayerCount = Number((await knex(Tables.MEMORIAM_PRAYERS).count({ count: '*' }))[0]?.count ?? 0);

  console.log(
    `Events/Memoriam seed OK: events=${eventCount}, tributes=${tributeCount}, prayers=${prayerCount}`,
  );
  console.log(`slug map: me=${meId}, me-sp=${meSpId}, pat-buyut-m=${patBuyutMId}`);
}
