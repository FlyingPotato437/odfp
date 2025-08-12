import { describe, it, expect } from 'vitest';
import { expandScientificQuery } from '@/lib/ai/scientific-expansion';
import { assessDataQuality } from '@/lib/ai/synthesis-engine';
import { rrfOrder } from '@/lib/hybridSearch';

describe('scientific expansion', () => {
  it('adds fisheries and Atlantic variants', async () => {
    const q = await expandScientificQuery('Fishing data in the Atlantic Ocean');
    const vars = q.suggestedVariables.map(v => v.toLowerCase());
    const locs = q.locationVariants.map(l => l.toLowerCase());
    expect(vars.some(v => ['cpue','effort','gear_type','haul'].some(k => v.includes(k)))).toBe(true);
    expect(locs.some(l => /north atlantic|gulf stream|sargasso/.test(l))).toBe(true);
  });
});

describe('data quality assessment', () => {
  it('computes quality metrics with provenance and variable depth', async () => {
    const now = new Date();
    const ds = {
      id: 'test:1',
      title: 'Test Dataset',
      timeStart: new Date(now.getFullYear()-2, 0, 1),
      timeEnd: new Date(now.getFullYear()-1, 11, 31),
      bboxMinX: -80, bboxMinY: 20, bboxMaxX: -10, bboxMaxY: 60,
      variables: [
        { name: 'sea_surface_temperature', standard_name: 'sea_surface_temperature', units: 'degC' } as any,
        { name: 'cpue' } as any
      ],
      distributions: [ { url: 'http://x', accessService: 'ERDDAP', format: 'NetCDF' } ],
      updatedAt: now,
      doi: '10.1234/x',
      publisher: 'NOAA',
      license: 'CC-BY'
    };
    const q = await assessDataQuality(ds as any);
    expect(q.recency).toBeGreaterThan(0.9);
    expect(q.spatialCoverage).toBeGreaterThan(0);
    expect(q.temporalCoverage).toBeGreaterThan(0);
    expect(q.variableRichness).toBeGreaterThan(0.1);
    expect(q.accessibilityScore).toBeGreaterThan(0.5);
    expect(q.completeness).toBeGreaterThan(0.5);
  });
});

describe('rrfOrder', () => {
  it('fuses lexical and semantic rankings', () => {
    const lex = { total: 3, page: 1, size: 3, results: [
      { id: 'A', title: 'A', variables: [], distributions: [], spatial: {}, time: {} } as any,
      { id: 'B', title: 'B', variables: [], distributions: [], spatial: {}, time: {} } as any,
      { id: 'C', title: 'C', variables: [], distributions: [], spatial: {}, time: {} } as any,
    ] };
    const sem = [ { id: 'C', score: 0.95 }, { id: 'B', score: 0.6 }, { id: 'D', score: 0.5 } ];
    const fused = rrfOrder(lex, sem, 4);
    // C should bubble up due to high semantic rank
    expect(fused[0]).toBe('C');
    // A appears due to lexical rank even if absent in semantic
    expect(fused).toContain('A');
    // D appears due to semantic-only presence
    expect(fused).toContain('D');
  });
});

