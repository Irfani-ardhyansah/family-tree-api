import { describe, expect, it } from 'vitest';
import { diffDescriptions } from './task-board.descriptions';
import type { TaskDescriptionInput } from './task-board.types';

const lama = (id: number, title: string, content = '<p>isi</p>') => ({ id, title, content });
const baru = (entry: TaskDescriptionInput) => entry;

describe('diffDescriptions', () => {
  it('semua entri baru saat task belum punya deskripsi', () => {
    const diff = diffDescriptions([], [baru({ title: 'Konteks', content: '<p>a</p>' })]);

    expect(diff.added).toHaveLength(1);
    expect(diff.added[0]).toMatchObject({ title: 'Konteks' });
    expect(diff.updated).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.keptIds.size).toBe(0);
  });

  it('tidak ada perubahan saat payload sama persis', () => {
    const diff = diffDescriptions([lama(3, 'Konteks')], [
      baru({ id: 3, title: 'Konteks', content: '<p>isi</p>' }),
    ]);

    expect(diff.added).toHaveLength(0);
    expect(diff.updated).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.keptIds.has(3)).toBe(true);
  });

  it('mendeteksi judul yang diubah', () => {
    const diff = diffDescriptions([lama(3, 'Konteks')], [
      baru({ id: 3, title: 'Konteks baru', content: '<p>isi</p>' }),
    ]);

    expect(diff.updated).toHaveLength(1);
    expect(diff.updated[0]).toMatchObject({ id: 3, title: 'Konteks baru' });
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });

  it('mendeteksi isi yang diubah', () => {
    const diff = diffDescriptions([lama(3, 'Konteks')], [
      baru({ id: 3, title: 'Konteks', content: '<p>beda</p>' }),
    ]);

    expect(diff.updated).toHaveLength(1);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });

  it('mendeteksi entri yang tidak dikirim lagi sebagai dihapus', () => {
    const diff = diffDescriptions(
      [lama(3, 'Konteks'), lama(4, 'Acceptance')],
      [baru({ id: 3, title: 'Konteks', content: '<p>isi</p>' })],
    );

    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0]).toMatchObject({ id: 4, title: 'Acceptance' });
    expect(diff.added).toHaveLength(0);
    expect(diff.updated).toHaveLength(0);
  });

  it('id asing diperlakukan sebagai entri baru (bukan update)', () => {
    const diff = diffDescriptions([lama(3, 'Konteks')], [
      baru({ id: 3, title: 'Konteks', content: '<p>isi</p>' }),
      baru({ id: 999, title: 'Baru', content: '<p>x</p>' }),
    ]);

    expect(diff.added).toHaveLength(1);
    expect(diff.added[0]).toMatchObject({ title: 'Baru' });
    expect(diff.keptIds.has(999)).toBe(false);
    expect(diff.removed).toHaveLength(0);
  });

  it('menangani campuran tambah + ubah + hapus sekaligus', () => {
    const diff = diffDescriptions(
      [lama(3, 'Konteks'), lama(4, 'Lama')],
      [
        baru({ id: 3, title: 'Konteks', content: '<p>diubah</p>' }),
        baru({ title: 'Segar', content: '<p>baru</p>' }),
      ],
    );

    expect(diff.updated).toHaveLength(1);
    expect(diff.added).toHaveLength(1);
    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0]).toMatchObject({ id: 4 });
  });
});
