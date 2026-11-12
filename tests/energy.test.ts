import { describe, expect, it } from 'vitest';
import { extraConsumption, mineConsumption, perSatellite, satelliteBase, satellitesFor } from '../src/engines/energy';

describe('energy', () => {
  it('mine consumption matches the game', () => {
    // Metal mine 41 → 42: the game asks 2589 more energy; metal 45 → 46: 4082.
    expect(mineConsumption(1, 42)! - mineConsumption(1, 41)!).toBe(2589);
    expect(mineConsumption(1, 46)! - mineConsumption(1, 45)!).toBe(4082);
    expect(mineConsumption(3, 1)).toBe(22);
    expect(mineConsumption(4, 10)).toBeNull();
  });

  it('extends the game number over a range only where the formula is known', () => {
    expect(extraConsumption(1, 42, 42, 2589)).toBe(2589);
    expect(extraConsumption(1, 42, 43, 2589)).toBe(2589 + 2903);
    expect(extraConsumption(11101, 5, 6, 100)).toBeNull();
  });

  it('satellites needed, only when the balance does not cover the need', () => {
    expect(satellitesFor(-2589, 0, 36)).toEqual({ count: 72, energy: 2589 });
    expect(satellitesFor(500, 2589, 36)).toEqual({ count: 59, energy: 2089 });
    expect(satellitesFor(3000, 2589, 36)).toBeNull();
  });

  it('per satellite: learned value, else temperature × bonus of the last planet learned', () => {
    expect(satelliteBase(67)).toBe(34);
    const book = { '1': { perUnit: 55, maxTemp: 67, at: 1 } };
    expect(perSatellite(book, 1, 67)).toEqual({ value: 55, exact: true });
    expect(perSatellite(book, 2, 7)).toEqual({ value: satelliteBase(7) * (55 / 34), exact: false });
    expect(perSatellite({}, 2, 7)).toEqual({ value: 24, exact: false });
    expect(perSatellite({}, 2, null)).toBeNull();
  });
});
