import { describe, expect, it } from 'vitest';
import { GenerationLabelService } from './generation-label.service';
import { PersonGraphNode } from './persons.types';

describe('generation-label.service', () => {
  const graph: PersonGraphNode[] = [
    { id: 1, gender: 'male', fatherId: 2, motherId: 3, spouseIds: [4] },
    { id: 2, gender: 'male', fatherId: null, motherId: null, spouseIds: [3] },
    { id: 3, gender: 'female', fatherId: null, motherId: null, spouseIds: [2] },
    { id: 4, gender: 'female', fatherId: null, motherId: null, spouseIds: [1] },
    { id: 5, gender: 'male', fatherId: 2, motherId: 3, spouseIds: [] },
  ];

  const service = new GenerationLabelService();

  it('labels self as Kamu', () => {
    expect(service.build(1, 1, graph)).toBe('Kamu');
  });

  it('labels parents', () => {
    expect(service.build(1, 2, graph)).toBe('Ayah');
    expect(service.build(1, 3, graph)).toBe('Ibu');
  });

  it('labels spouse and sibling', () => {
    expect(service.build(1, 4, graph)).toBe('Pasangan');
    expect(service.build(1, 5, graph)).toBe('Saudara');
  });
});
