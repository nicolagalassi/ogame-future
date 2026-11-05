/**
 * Costs of buildings, research, ships and defences for any level, the way the game computes
 * them. Pure functions: no DOM, no network.
 *
 * Bonuses (lifeform discounts, class, events) are not recomputed here: the game already shows
 * the discounted cost of one level, so `discountFrom` reads the bonus out of that number and
 * applies it to every other level. The formulas are the game's, as in OGLight (MIT, © 2019 Oz).
 */
import { TECH_TABLE } from '../data/tech-table';

export interface Cost {
  metal: number;
  crystal: number;
  deuterium: number;
  /** Energy needed to build (terraformer, space dock, graviton), not the extra consumption. */
  energy: number;
}

export const ZERO_COST: Cost = { metal: 0, crystal: 0, deuterium: 0, energy: 0 };

export type TechKind = 'building' | 'research' | 'lfBuilding' | 'lfResearch' | 'unit';

export function techKind(id: number): TechKind | null {
  if (!TECH_TABLE[id]) return null;
  if (id < 100) return 'building';
  if (id < 200) return 'research';
  if (id < 600) return 'unit';
  const group = Math.floor((id % 1000) / 100);
  return group === 1 ? 'lfBuilding' : 'lfResearch';
}

/** Levelled techs: each level costs more. Units (ships, defences) cost the same each time. */
export const isLevelled = (id: number): boolean => {
  const kind = techKind(id);
  return kind !== null && kind !== 'unit';
};

/** Cost of one level (or one unit) before any bonus. */
export function rawCost(id: number, level: number): Cost {
  const row = TECH_TABLE[id];
  const kind = techKind(id);
  if (!row || !kind) return { ...ZERO_COST };
  const [m, c, d, factor, energy, energyFactor] = row;
  if (kind === 'unit') return { metal: m, crystal: c, deuterium: d, energy: 0 };
  const k = Math.pow(factor, level - 1);
  if (kind === 'lfBuilding' || kind === 'lfResearch') {
    // Lifeform techs also scale with the level itself.
    return { metal: Math.floor(m * k * level), crystal: Math.floor(c * k * level), deuterium: Math.floor(d * k * level), energy: 0 };
  }
  return {
    metal: Math.floor(m * k),
    crystal: Math.floor(c * k),
    deuterium: Math.floor(d * k),
    energy: Math.floor(energy * Math.pow(energyFactor, level - 1)),
  };
}

const KEYS = ['metal', 'crystal', 'deuterium', 'energy'] as const;

/** The largest resource of a cost: the one that gives the most precise ratio. */
function main(cost: Cost): (typeof KEYS)[number] | null {
  let best: (typeof KEYS)[number] | null = null;
  for (const key of KEYS) if (cost[key] > 0 && (best === null || cost[key] > cost[best])) best = key;
  return best;
}

/**
 * The bonus the game applied, as a fraction (0.12 = 12% cheaper), from the cost it shows for
 * `level`. Returns null when the shown cost does not fit that level.
 */
export function discountFrom(id: number, level: number, shown: Partial<Cost>): number | null {
  const raw = rawCost(id, level);
  const key = main(raw);
  if (!key) return null;
  const value = shown[key];
  if (value === undefined || !(value > 0)) return null;
  const ratio = value / raw[key];
  // Bonuses only make things cheaper: a ratio above 1 means another level is shown.
  if (ratio > 1.001 || ratio < 0.2) return null;
  return Math.max(0, 1 - ratio);
}

/**
 * Which of the candidate levels the shown cost belongs to, with its bonus. The game's panel
 * may show the next level or the one after a level already in construction: the right one is
 * the lowest bonus that is still a bonus (higher levels give a smaller ratio).
 */
export function matchShownLevel(id: number, candidates: number[], shown: Partial<Cost>): { level: number; discount: number } | null {
  let best: { level: number; discount: number } | null = null;
  for (const level of new Set(candidates.filter((l) => l >= 1))) {
    const discount = discountFrom(id, level, shown);
    if (discount === null) continue;
    if (!best || discount < best.discount) best = { level, discount };
  }
  return best;
}

/** Cost of one level after the bonus. Units: cost of one unit. */
export function levelCost(id: number, level: number, discount = 0): Cost {
  const raw = rawCost(id, level);
  const keep = 1 - discount;
  return {
    metal: Math.floor(raw.metal * keep),
    crystal: Math.floor(raw.crystal * keep),
    deuterium: Math.floor(raw.deuterium * keep),
    energy: Math.floor(raw.energy * keep),
  };
}

export function addCost(a: Cost, b: Cost): Cost {
  return { metal: a.metal + b.metal, crystal: a.crystal + b.crystal, deuterium: a.deuterium + b.deuterium, energy: Math.max(a.energy, b.energy) };
}

export function scaleCost(a: Cost, n: number): Cost {
  return { metal: a.metal * n, crystal: a.crystal * n, deuterium: a.deuterium * n, energy: a.energy };
}

/** Total from level `from` to `to` included (from ≤ to). Energy is the highest single need. */
export function rangeCost(id: number, from: number, to: number, discount = 0): Cost {
  let total = { ...ZERO_COST };
  for (let level = from; level <= to; level++) total = addCost(total, levelCost(id, level, discount));
  return total;
}

/**
 * Relative build time of a level. Only the shape matters: the panel scales the time the game
 * shows for one level (robotics, nanites, lab network, speed and bonuses are already in it).
 */
export function durationWeight(id: number, level: number): number {
  const row = TECH_TABLE[id];
  const kind = techKind(id);
  if (!row || !kind) return 0;
  if (kind === 'unit') return 1;
  if (kind === 'lfBuilding' || kind === 'lfResearch') return level * Math.pow(row[7], level);
  const raw = rawCost(id, level);
  const sum = raw.metal + raw.crystal;
  if (kind === 'research') return sum;
  // Buildings are faster at low levels; moon base and gates have no such factor.
  const flat = id === 15 || id === 41 || id === 42 || id === 43;
  return sum / (flat ? 1 : Math.max(4 - level / 2, 1));
}

/** Build time of `level` from the time the game shows for `shownLevel`. */
export function scaleDuration(id: number, shownLevel: number, shownMs: number, level: number): number {
  const base = durationWeight(id, shownLevel);
  return base > 0 ? (shownMs * durationWeight(id, level)) / base : 0;
}

/** Missing resources against what is available: only the positive gaps. */
export function missing(cost: Cost, have: { metal: number; crystal: number; deuterium: number }): Cost {
  return {
    metal: Math.max(0, cost.metal - have.metal),
    crystal: Math.max(0, cost.crystal - have.crystal),
    deuterium: Math.max(0, cost.deuterium - have.deuterium),
    energy: 0,
  };
}

/** ISO 8601 duration (the game's <time datetime="PT1H2M3S">) in milliseconds. */
export function isoDurationMs(value: string): number | null {
  const m = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(value.trim());
  if (!m) return null;
  const [w = 0, d = 0, h = 0, min = 0, s = 0] = m.slice(1).map((x) => Number(x ?? 0));
  return ((((w * 7 + d) * 24 + h) * 60 + min) * 60 + s) * 1000;
}
