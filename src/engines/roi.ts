/**
 * Amortization advisor, after InfoCompte's "Amortizations" (MIT, Vulca, benneb, The Stubbs):
 * mines, plasma technology and astrophysics (a new colony) ranked by the days the extra
 * production takes to pay the cost back, in units of metal at the player's trade rates.
 * Each step is applied before the next one is chosen, so the list is a build order.
 *
 * Production: the mine formula (position and temperature bonuses, universe speed) gives each
 * mine's base output; everything else the game adds (plasma, class, officers, lifeforms,
 * crawlers, boosters) is read out of the production accountInfo reports, as one multiplier per
 * planet and resource. Not counted, as in InfoCompte: energy, lifeform cost discounts.
 */
import type { AccountSnapshot, Resources } from '../data/account-info';
import { addCost, levelCost, rangeCost, scaleCost, techKind, ZERO_COST, type Cost } from './tech';

export type MineKey = 'metal' | 'crystal' | 'deuterium';
const KEYS: MineKey[] = ['metal', 'crystal', 'deuterium'];
const MINE_ID: Record<MineKey, number> = { metal: 1, crystal: 2, deuterium: 3 };
const PLASMA = 122;
const ASTRO = 124;
/** Plasma technology: extra share of the mines' base output per level. */
const PLASMA_RATE: Resources = { metal: 0.01, crystal: 0.0066, deuterium: 0.0033 };
const METAL_POS = [1.35, 1.23, 1.17, 1];
const CRYSTAL_POS = [1.4, 1.3, 1.2, 1];
/** Moon buildings, left out of a new colony's planet. */
const MOON_ONLY = new Set([41, 42, 43]);

/** Trade rates as metal : crystal : deuterium (3 : 2 : 1 = the usual MSU). */
export type Rates = Resources;
export const DEFAULT_RATES: Rates = { metal: 3, crystal: 2, deuterium: 1 };

/** Value of some resources in metal at these rates. */
export function inMetal(r: Resources, rates: Rates): number {
  return KEYS.reduce((sum, k) => sum + (rates[k] > 0 ? (r[k] * rates.metal) / rates[k] : 0), 0);
}

/** Base output per hour of one mine (no bonus but position / temperature and speed). */
export function mineBase(mine: MineKey, level: number, position: number, maxTemp: number, speed: number): number {
  const k = speed * level * Math.pow(1.1, level);
  if (mine === 'metal') return Math.trunc(30 * k * METAL_POS[Math.min(3, Math.abs(position - 8))]!);
  if (mine === 'crystal') return Math.trunc(20 * k * CRYSTAL_POS[Math.min(3, Math.max(0, position - 1))]!);
  return Math.trunc(10 * k * (1.44 - 0.004 * maxTemp));
}

export interface PlanetInput {
  id: number;
  name: string;
  coords: string;
  /** Max temperature (°C) from the planet list; null = unknown. */
  maxTemp: number | null;
}

export interface AmortStep {
  kind: 'mine' | 'plasma' | 'astro';
  mine?: MineKey;
  planetId?: number;
  name?: string;
  coords?: string;
  from: number;
  to: number;
  cost: Cost;
  /** Extra production per hour. */
  gain: Resources;
  /** Days to pay the cost back with the extra production, at the trade rates. */
  days: number;
}

interface PlanetState {
  input: PlanetInput;
  position: number;
  temp: number;
  levels: Record<MineKey, number>;
  /** Everything the game adds on top of the mine base, per resource (≥ 1). */
  mult: Resources;
  production: Resources;
}

const zero = (): Resources => ({ metal: 0, crystal: 0, deuterium: 0 });
const days = (cost: Resources, gain: Resources, rates: Rates) => {
  const g = inMetal(gain, rates);
  return g > 0 ? inMetal(cost, rates) / (g * 24) : Infinity;
};

/** What a planet with its moon is built of (buildings, lifeform buildings, defences), for the new colony's cost. */
function equipment(levels: Record<string, number>, moon: boolean): Cost {
  let total = { ...ZERO_COST };
  for (const [key, value] of Object.entries(levels)) {
    const id = Number(key);
    const kind = techKind(id);
    if (!value || !kind) continue;
    // Defences count by unit; ships and missiles are not part of a planet's equipment.
    if (kind === 'unit') {
      if (id >= 400 && id < 500) total = addCost(total, scaleCost(levelCost(id, 1), value));
    } else if ((kind === 'building' && (moon || !MOON_ONLY.has(id))) || (kind === 'lfBuilding' && !moon)) {
      total = addCost(total, rangeCost(id, 1, value));
    }
  }
  return { ...total, energy: 0 };
}

export interface AmortInput {
  snapshot: AccountSnapshot | null;
  planets: PlanetInput[];
  speed: number;
  rates?: Rates;
  steps?: number;
}

export function amortizationPlan({ snapshot, planets, speed, rates = DEFAULT_RATES, steps = 20 }: AmortInput): AmortStep[] {
  if (!snapshot) return [];
  const byId = new Map(snapshot.bodies.map((b) => [b.id, b]));
  const state: PlanetState[] = [];
  for (const input of planets) {
    const body = byId.get(input.id);
    if (!body || body.type !== 'planet') continue;
    const position = Number(input.coords.split(':')[2]) || 8;
    const temp = input.maxTemp ?? 50;
    const levels = { metal: body.levels['1'] ?? 0, crystal: body.levels['2'] ?? 0, deuterium: body.levels['3'] ?? 0 };
    const flat: Resources = { metal: 30 * speed, crystal: 15 * speed, deuterium: 0 };
    const mult = zero();
    for (const k of KEYS) {
      const base = mineBase(k, levels[k], position, temp, speed);
      mult[k] = base > 0 ? Math.max(1, (body.production[k] - flat[k]) / base) : 1;
    }
    state.push({ input, position, temp, levels, mult, production: { ...body.production } });
  }
  if (!state.length) return [];

  // A new colony: the planets' equipment on average, its production on average.
  const count = state.length;
  let equip = { ...ZERO_COST };
  for (const p of state) {
    const body = byId.get(p.input.id)!;
    equip = addCost(equip, equipment(body.levels, false));
    const moon = body.siblingId ? byId.get(body.siblingId) : undefined;
    if (moon) equip = addCost(equip, equipment(moon.levels, true));
  }
  const colonyCost: Cost = { metal: equip.metal / count, crystal: equip.crystal / count, deuterium: equip.deuterium / count, energy: 0 };

  let plasma = snapshot.researches[String(PLASMA)] ?? 0;
  let astro = snapshot.researches[String(ASTRO)] ?? 0;
  /** Colonies the plan has already added (each produces like an average planet). */
  let extra = 0;
  const out: AmortStep[] = [];
  for (let i = 0; i < steps; i++) {
    let best: AmortStep | null = null;
    const consider = (s: AmortStep) => {
      if (Number.isFinite(s.days) && (!best || s.days < best.days)) best = s;
    };
    for (const p of state) {
      for (const k of KEYS) {
        const L = p.levels[k];
        const gain = zero();
        gain[k] = (mineBase(k, L + 1, p.position, p.temp, speed) - mineBase(k, L, p.position, p.temp, speed)) * p.mult[k];
        const cost = levelCost(MINE_ID[k], L + 1);
        consider({ kind: 'mine', mine: k, planetId: p.input.id, name: p.input.name, coords: p.input.coords, from: L, to: L + 1, cost, gain, days: days(cost, gain, rates) });
      }
    }
    const plasmaGain = zero();
    for (const p of state) for (const k of KEYS) plasmaGain[k] += mineBase(k, p.levels[k], p.position, p.temp, speed) * PLASMA_RATE[k];
    for (const k of KEYS) plasmaGain[k] *= (count + extra) / count;
    const plasmaCost = levelCost(PLASMA, plasma + 1);
    consider({ kind: 'plasma', from: plasma, to: plasma + 1, cost: plasmaCost, gain: plasmaGain, days: days(plasmaCost, plasmaGain, rates) });
    // A new slot comes with every odd level of astrophysics.
    const next = astro % 2 === 1 ? astro + 2 : astro + 1;
    const astroCost = addCost(rangeCost(ASTRO, astro + 1, next), colonyCost);
    const avg = zero();
    for (const p of state) for (const k of KEYS) avg[k] += p.production[k] / count;
    consider({ kind: 'astro', from: astro, to: next, cost: astroCost, gain: avg, days: days(astroCost, avg, rates) });

    const step = best as AmortStep | null;
    if (!step) break;
    out.push(step);
    if (step.kind === 'mine') {
      const p = state.find((x) => x.input.id === step.planetId)!;
      p.levels[step.mine!] = step.to;
      p.production[step.mine!] += step.gain[step.mine!];
    } else if (step.kind === 'plasma') {
      plasma = step.to;
      for (const p of state)
        for (const k of KEYS) {
          const add = mineBase(k, p.levels[k], p.position, p.temp, speed) * PLASMA_RATE[k];
          p.mult[k] += PLASMA_RATE[k];
          p.production[k] += add;
        }
    } else {
      astro = step.to;
      extra++;
    }
  }
  return out;
}
