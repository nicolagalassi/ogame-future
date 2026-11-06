import { describe, expect, it } from 'vitest';
import { formatUnits } from '../src/core/format';
import { applyPageResources, estimateResources, storageCapacity, storageFill, totals } from '../src/engines/resources';
import { SNAPSHOT, body } from './fixtures';

describe('formatUnits', () => {
  it('shortens with the Italian decimal mark', () => {
    expect(formatUnits(415_900, 'it')).toBe('416k');
    expect(formatUnits(38_300_000, 'it')).toBe('38,3M');
    expect(formatUnits(9_500_000_000, 'it')).toBe('9,5G');
    expect(formatUnits(839, 'it')).toBe('839');
  });

  it('moves to the next unit instead of printing 1000', () => {
    expect(formatUnits(999_960_000, 'it')).toBe('1,0G');
    expect(formatUnits(999_400_000, 'it')).toBe('999M');
    expect(formatUnits(999.6, 'it')).toBe('1,0k');
    expect(formatUnits(-999_700, 'it')).toBe('-1,0M');
  });
});

describe('estimateResources', () => {
  it('adds hourly production on planets, pro rata', () => {
    const p = body({ id: 1, type: 'planet', production: { metal: 3600, crystal: 0, deuterium: 0 } });
    expect(estimateResources(p, 60_000).metal).toBe(60);
    expect(estimateResources(p, 3_600_000).metal).toBe(3600);
  });

  it('stops at storage but never lowers an amount already above it', () => {
    const p = body({ id: 1, type: 'planet', production: { metal: 36_000, crystal: 0, deuterium: 0 },
      resources: { metal: 950, crystal: 2000, deuterium: 0 }, storage: { metal: 1000, crystal: 1000, deuterium: 0 } });
    const r = estimateResources(p, 60_000);
    expect(r.metal).toBe(1000);
    expect(r.crystal).toBe(2000);
  });

  it('moons do not produce', () => {
    const m = body({ id: 2, type: 'moon', production: { metal: 10, crystal: 0, deuterium: 0 } });
    expect(estimateResources(m, 60_000).metal).toBe(0);
  });

  it('computes storage from the storage building levels (22/23/24)', () => {
    expect(storageCapacity(0)).toBe(10_000);
    expect(storageCapacity(1)).toBe(20_000);
    expect(storageCapacity(10)).toBe(5_355_000);
    const b = body({ id: 9, type: 'planet', levels: { '22': 1, '23': 0, '24': 0 } });
    expect(storageFill(b, { metal: 10_000, crystal: 10_000, deuterium: 0 })).toEqual({ metal: 0.5, crystal: 1, deuterium: 0 });
  });

  it('storageFill is null when storage is unknown', () => {
    expect(storageFill(body({ id: 9, type: 'planet' }), { metal: 1, crystal: 1, deuterium: 1 })).toBeNull();
  });
});

describe('applyPageResources and totals', () => {
  it('overwrites the viewed body and sums planets and moons', () => {
    const snap = structuredClone(SNAPSHOT);
    expect(applyPageResources(snap, 1, { metal: 5, crystal: 6, deuterium: 7 }, 0)).toBe(true);
    const { stock, perHour } = totals(snap, 0);
    expect(stock.metal).toBe(5 + 292_600_000);
    expect(perHour.metal).toBe(10);
  });
});
