/**
 * Mine upgrade advisor: which next mine level pays itself back first, in MSU.
 * Estimate only (shown as such): the production gain scales the planet's current
 * production by the mine formula L·1.1^L; energy, lifeform cost reductions and
 * the flat base production are not counted.
 */
import type { AccountSnapshot, Resources } from '../data/account-info';
import type { PlanetListEntry } from '../data/planet-list';

export type MineKey = 'metal' | 'crystal' | 'deuterium';

const MINES: Record<MineKey, { id: string; base: [number, number]; factor: number }> = {
  metal: { id: '1', base: [60, 15], factor: 1.5 },
  crystal: { id: '2', base: [48, 24], factor: 1.6 },
  deuterium: { id: '3', base: [225, 75], factor: 1.5 },
};
const WEIGHT: Record<MineKey, number> = { metal: 1, crystal: 1.5, deuterium: 3 };

/** Metal and crystal cost to go from level L to L+1. */
export function mineCost(mine: MineKey, level: number): Resources {
  const { base, factor } = MINES[mine];
  const k = Math.pow(factor, level);
  return { metal: Math.floor(base[0] * k), crystal: Math.floor(base[1] * k), deuterium: 0 };
}

/** Relative production gain from L to L+1 (mine output ∝ L·1.1^L). */
export function mineGainRatio(level: number): number {
  if (level <= 0) return 0;
  return ((level + 1) * 1.1) / level - 1;
}

export interface UpgradeMove {
  planetId: number;
  name: string;
  coords: string;
  mine: MineKey;
  from: number;
  cost: Resources;
  costMsu: number;
  gainPerHour: number;
  /** Days to pay back the cost with the extra production, in MSU. */
  days: number;
}

export function bestUpgrades(snapshot: AccountSnapshot | null, entries: PlanetListEntry[], limit = 5): UpgradeMove[] {
  if (!snapshot) return [];
  const byId = new Map(snapshot.bodies.map((b) => [b.id, b]));
  const moves: UpgradeMove[] = [];
  for (const entry of entries) {
    const body = entry.planetId ? byId.get(entry.planetId) : undefined;
    if (!body || body.type !== 'planet') continue;
    for (const mine of Object.keys(MINES) as MineKey[]) {
      const level = body.levels[MINES[mine].id] ?? 0;
      const ratio = mineGainRatio(level);
      const gain = body.production[mine] * ratio;
      if (gain <= 0) continue;
      const cost = mineCost(mine, level);
      const costMsu = cost.metal + cost.crystal * 1.5;
      const gainPerHour = gain * WEIGHT[mine];
      moves.push({
        planetId: body.id, name: entry.name || body.name, coords: entry.coords || body.coords,
        mine, from: level, cost, costMsu, gainPerHour, days: costMsu / (gainPerHour * 24),
      });
    }
  }
  return moves.sort((a, b) => a.days - b.days).slice(0, limit);
}
