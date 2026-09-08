# Family Core — Nuclear Family Members Filter (BE Prompt)

## Goal

`GET /api/v1/fc/members` harus mengembalikan **keluarga inti** relatif ke actor yang login, **bukan** seluruh `family_members` (pohon keluarga besar).

Saat ini `listCoreMembers()` = semua orang di `family_members` → saudara, paman, sepupu ikut muncul di selector dokumen / health / kalender. Itu salah untuk Family Core.

---

## Definisi keluarga inti (relatif ke `actorPersonId`)

**Include:**
1. **Self** — actor
2. **Spouse** — dari `person_spouses`
3. **Children** — orang yang di `person_lineage` punya `father_id` atau `mother_id` = self (atau = spouse, untuk anak pasangan)
4. **Parents** — `father_id` / `mother_id` dari lineage self
5. **Parents-in-law** — parents dari spouse (jika ada pasangan)

**Exclude:**
- Saudara kandung / tiri
- Paman, bibi, sepupu, keponakan
- Cabang keluarga besar lain yang kebetulan ada di `family_members`

---

## Response DTO (usulan)

Pertahankan shape sekarang, perkuat `kind` / `relationLabel`:

```ts
{
  personId: number
  fullName: string
  nickname: string | null
  photoUrl: string | null
  gender: string | null
  kind: 'self' | 'spouse' | 'child' | 'parent' | 'in_law'
  relationLabel: string | null // e.g. "Anak", "Ibu", "Mertua (ayah)"
}
```

Sort suggestion: self → spouse → parents → children → in_laws, lalu nama.

---

## Juga apply ke validasi dokumen

`assertSelectablePerson` di documents service harus memakai **set anggota inti yang sama**, supaya API menolak create/update dokumen untuk orang di luar keluarga inti (meski FE di-filter).

---

## FE impact

Setelah BE siap:
- FE `mapFcMember` bisa map `kind` → role UI
- Tidak perlu hard-filter di FE (sumber kebenaran = BE)

---

## Files BE terkait

- `src/modules/family-core/fc-access.repository.ts` — ganti/expand `listCoreMembers`
- `src/modules/family-core/members/members.service.ts`
- `src/modules/family-core/documents/documents.service.ts` — `assertSelectablePerson`
