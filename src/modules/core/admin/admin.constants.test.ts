import { describe, expect, it } from 'vitest';
import {
  MODULE_LABELS,
  MODULE_STATUS_IDS,
  isModuleStatusId,
} from './admin.constants';

describe('module status constants', () => {
  it('mendaftarkan task-board supaya toggle dari panel admin tidak 404', () => {
    expect(MODULE_STATUS_IDS).toContain('task-board');
    expect(isModuleStatusId('task-board')).toBe(true);
  });

  it('punya label untuk setiap module status id', () => {
    for (const id of MODULE_STATUS_IDS) {
      expect(MODULE_LABELS[id]).toBeTruthy();
    }
    expect(MODULE_LABELS['task-board']).toBe('Task Board');
  });

  it('menolak module id yang tidak dikenal', () => {
    expect(isModuleStatusId('unknown-module')).toBe(false);
    expect(isModuleStatusId('')).toBe(false);
  });
});
