import fs from 'fs';
import path from 'path';
import type { Knex } from 'knex';

type SeedPerson = { id: string };

type SeedPayload = {
  persons: SeedPerson[];
};

function loadSlugToIdMap(): Map<string, number> {
  const seedPath = path.resolve(__dirname, '../../../docs/seed/mock-family-seed.json');
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

  await knex('memoriam_prayers').del();
  await knex('memoriam_tribute_photos').del();
  await knex('memoriam_tributes').del();
  await knex('family_event_contributions').del();
  await knex('family_event_photos').del();
  await knex('family_event_attendees').del();
  await knex('family_event_persons').del();
  await knex('family_events').del();

  const meId = id(slugToId, 'me');
  const meSpId = id(slugToId, 'me-sp');
  const fatherId = id(slugToId, 'father');
  const patBuyutMId = id(slugToId, 'pat-buyut-m');
  const matBuyutMId = id(slugToId, 'mat-buyut-m');

  const [reunionId] = await knex('family_events').insert({
    family_id: familyId,
    title: 'Reuni Keluarga Besar 2024',
    type: 'reunion',
    date: '2024-12-25',
    end_date: '2024-12-26',
    location: 'Malang, Jawa Timur',
    description: 'Acara reuni tahunan seluruh keluarga.',
    created_by_person_id: meId,
  });

  const [weddingId] = await knex('family_events').insert({
    family_id: familyId,
    title: 'Pernikahan Irfani & Ayu',
    type: 'wedding',
    date: '2025-06-14',
    end_date: null,
    location: 'Masjid Al-Falah, Malang',
    description: 'Akad dan resepsi pernikahan.',
    created_by_person_id: meId,
  });

  const [birthdayId] = await knex('family_events').insert({
    family_id: familyId,
    title: 'Ulang Tahun Ayah',
    type: 'birthday',
    date: '2025-01-20',
    end_date: null,
    location: 'Rumah Jl. Diponegoro',
    description: null,
    created_by_person_id: fatherId,
  });

  const [restrictedMeId] = await knex('family_events').insert({
    family_id: familyId,
    title: 'Rapat Inti Keluarga (Restricted)',
    type: 'other',
    date: '2025-03-01',
    end_date: null,
    location: 'Private — hanya undangan',
    description: 'Acara restricted untuk uji EVENT_ACCESS_FORBIDDEN.',
    created_by_person_id: meId,
  });

  const [restrictedSpId] = await knex('family_events').insert({
    family_id: familyId,
    title: 'Arisan Keluarga Ayu (Restricted)',
    type: 'other',
    date: '2025-04-10',
    end_date: null,
    location: 'Rumah orang tua Ayu',
    description: 'Acara restricted di subgraph pasangan.',
    created_by_person_id: meSpId,
  });

  const [deathId] = await knex('family_events').insert({
    family_id: familyId,
    title: 'Tahlilan H. Ardhyansah',
    type: 'death',
    date: '1998-08-25',
    end_date: null,
    location: 'Desa asal, Malang',
    description: 'Mengenang almarhum buyut paternal.',
    created_by_person_id: fatherId,
  });

  await knex('family_event_persons').insert([
    { event_id: weddingId, person_id: meId },
    { event_id: weddingId, person_id: meSpId },
    { event_id: birthdayId, person_id: fatherId },
    { event_id: deathId, person_id: patBuyutMId },
    { event_id: restrictedSpId, person_id: meSpId },
    { event_id: restrictedSpId, person_id: id(slugToId, 'sp-father') },
  ]);

  await knex('family_event_attendees').insert([
    { event_id: restrictedMeId, person_id: meId },
    { event_id: restrictedSpId, person_id: meSpId },
  ]);

  await knex('family_event_photos').insert([
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

  await knex('family_event_contributions').insert([
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
    const [tributeId] = await knex('memoriam_tributes').insert({
      family_id: familyId,
      deceased_person_id: patBuyutMId,
      author_person_id: i % 2 === 0 ? meId : fatherId,
      content: tributeContents[i],
    });

    if (i < 2) {
      await knex('memoriam_tribute_photos').insert({
        tribute_id: tributeId,
        photo_url: `https://cdn.example.com/memoriam/pat-buyut-m-${i + 1}.jpg`,
        sort_order: 0,
      });
    }
  }

  for (let i = 0; i < 4; i += 1) {
    await knex('memoriam_tributes').insert({
      family_id: familyId,
      deceased_person_id: matBuyutMId,
      author_person_id: i % 2 === 0 ? meId : id(slugToId, 'mother'),
      content: `<p>Kenangan almarhum H. Wijaya Kusuma — tribute ${i + 1}.</p>`,
    });
  }

  await knex('memoriam_prayers').insert([
    { family_id: familyId, deceased_person_id: patBuyutMId, author_person_id: meId },
    { family_id: familyId, deceased_person_id: patBuyutMId, author_person_id: fatherId },
    { family_id: familyId, deceased_person_id: patBuyutMId, author_person_id: id(slugToId, 'mother') },
    { family_id: familyId, deceased_person_id: patBuyutMId, author_person_id: meSpId },
    { family_id: familyId, deceased_person_id: patBuyutMId, author_person_id: id(slugToId, 'demo-mr') },
    { family_id: familyId, deceased_person_id: matBuyutMId, author_person_id: meId },
  ]);

  const eventCount = Number((await knex('family_events').count({ count: '*' }))[0]?.count ?? 0);
  const tributeCount = Number((await knex('memoriam_tributes').count({ count: '*' }))[0]?.count ?? 0);
  const prayerCount = Number((await knex('memoriam_prayers').count({ count: '*' }))[0]?.count ?? 0);

  console.log(
    `Events/Memoriam seed OK: events=${eventCount}, tributes=${tributeCount}, prayers=${prayerCount}`,
  );
  console.log(`slug map: me=${meId}, me-sp=${meSpId}, pat-buyut-m=${patBuyutMId}`);
}
