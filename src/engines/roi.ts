/**
 * Amortization advisor, after InfoCompte's "Amortizations" (MIT, Vulca, benneb, The Stubbs):
 * mines, plasma technology, astrophysics (a new colony) and the lifeform buildings and research
 * that raise production, ranked by the days the extra production takes to pay the cost back, in
 * units of metal at the player's trade rates. Each step is applied before the next one is
 * chosen, so the list is a build order.
 *
 * Production: the mine formula (position and temperature bonuses, universe speed) gives each
 * mine's base output; everything the game adds on top (plasma, class, officers, lifeforms,
 * crawlers, boosters) is read out of the production accountInfo reports, as one multiplier per
 * planet and resource, and each step adds its own share to it. Costs carry the lifeform
 * discounts InfoCompte counts (12111 mines, 12108 Rock'tal buildings, x103 research, 12209
 * plasma). Not counted, as in InfoCompte: energy.
 */
import type { AccountSnapshot, Resources } from '../data/account-info';
import { activeLfResearch, type LfLocked, type LfSlots } from '../data/lf-slots';
import {
  KAELESH_BOOSTER, LF_BUILDING_BONUS, LF_PRODUCTION_BUILDINGS, LF_PRODUCTION_RESEARCH, LF_RESEARCH_BONUS, LF_RESEARCH_BOOSTERS,
  LF_RESEARCH_DISCOUNT, PLASMA_DISCOUNT, PRODUCER_DISCOUNT, PRODUCERS, ROCKTAL_BUILDING_DISCOUNT, type LfLevels, type LfRow,
} from '../data/lf-production';
import { speciesOf } from '../data/tech-names';
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
  kind: 'mine' | 'plasma' | 'astro' | 'lfBuilding' | 'lfResearch';
  /** The technology raised. */
  id: number;
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
  /** Lifeform research whose slot was guessed (the planet's research page not seen yet). */
  guessed?: boolean;
}

interface PlanetState {
  input: PlanetInput;
  species: number;
  position: number;
  temp: number;
  levels: Record<string, number>;
  /** Active lifeform research, one per slot. */
  research: { id: number; guessed: boolean }[];
  /** Everything the game adds on top of the mine base, per resource (≥ 1). */
  mult: Resources;
  production: Resources;
}

const zero = (): Resources => ({ metal: 0, crystal: 0, deuterium: 0 });
const days = (cost: Resources, gain: Resources, rates: Rates) => {
  const g = inMetal(gain, rates);
  return g > 0 ? inMetal(cost, rates) / (g * 24) : Infinity;
};
const lvl = (p: PlanetState, id: number) => p.levels[String(id)] ?? 0;
const base = (p: PlanetState, k: MineKey, speed: number, level = lvl(p, MINE_ID[k])) => mineBase(k, level, p.position, p.temp, speed);

/** One column of a lifeform building's bonus on its planet (0 when it is not of the planet's species), capped. */
function building(p: PlanetState, id: number, column: 0 | 1 | 2, level = lvl(p, id)): number {
  const row = LF_BUILDING_BONUS[id];
  if (!row || speciesOf(id) !== p.species) return 0;
  return capped(row, column, row[column] * level);
}
const capped = (row: LfRow, column: 0 | 1 | 2, value: number) => (row[column + 3] ? Math.min(value, row[column + 3]!) : value);

/** How strong lifeform research is on this planet: its boosters, Kaelesh's own, the species level. */
function researchFactor(p: PlanetState, id: number, levels: LfLevels, boosters = LF_RESEARCH_BOOSTERS.reduce((s, [b, c]) => s + building(p, b, c), 0)): number {
  const kaelesh = speciesOf(id) === 4 ? building(p, KAELESH_BOOSTER, 0) : 0;
  return (1 + boosters) * (1 + kaelesh) * (1 + (levels[String(p.species)] ?? 0));
}

/** Discount on the next level of `id` on this planet, as a fraction. */
function discount(p: PlanetState, id: number): number {
  let d = 0;
  if (PRODUCERS.has(id)) d += building(p, PRODUCER_DISCOUNT, 0);
  const kind = techKind(id);
  if (kind === 'lfBuilding' && speciesOf(id) === 2) d += building(p, ROCKTAL_BUILDING_DISCOUNT, 0);
  if (kind === 'lfResearch') for (const b of LF_RESEARCH_DISCOUNT) d += building(p, b, 0);
  return Math.min(d, 0.99);
}

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
  /** Active lifeform research per planet, as seen on the game's page (else guessed). */
  lfSlots?: LfSlots;
  /** Species technology bonus from its level (lifeform settings page); unknown = 0. */
  lfLevels?: LfLevels;
  /** Lifeform technologies locked by their requirements, per planet, from the game's pages. */
  lfLocked?: LfLocked;
  /** Kinds left out of the list (as InfoCompte's settings): a mine by its resource, or a step kind. */
  exclude?: InvestKind[];
}

/** What the list can offer, as InfoCompte's settings: each mine, lifeform buildings and research, plasma, astrophysics. */
export const INVEST_KINDS = ['metal', 'crystal', 'deuterium', 'lfBuilding', 'lfResearch', 'plasma', 'astro'] as const;
export type InvestKind = (typeof INVEST_KINDS)[number];

/**
 * Whether a lifeform technology can be raised on this planet: built already (so unlocked), or
 * at level 0 on a page the player has opened that does not show it locked. Never seen = no.
 */
function open(locked: LfLocked, planetId: number, id: number, level: number): boolean {
  if (level > 0) return true;
  const seen = locked[String(planetId)]?.[techKind(id) === 'lfBuilding' ? 'b' : 'r'];
  return seen !== undefined && !seen.includes(id);
}

export function amortizationPlan({ snapshot, planets, speed, rates = DEFAULT_RATES, steps = 20, lfSlots = {}, lfLevels = {}, lfLocked = {}, exclude = [] }: AmortInput): AmortStep[] {
  if (!snapshot) return [];
  const byId = new Map(snapshot.bodies.map((b) => [b.id, b]));
  const state: PlanetState[] = [];
  for (const input of planets) {
    const body = byId.get(input.id);
    if (!body || body.type !== 'planet') continue;
    const p: PlanetState = {
      input,
      species: body.species ?? 0,
      position: Number(input.coords.split(':')[2]) || 8,
      temp: input.maxTemp ?? 50,
      levels: { ...body.levels },
      research: activeLfResearch(body, lfSlots[String(body.id)]).map((r) => ({ id: r.id, guessed: r.guessed })),
      mult: zero(),
      production: { ...body.production },
    };
    const flat: Resources = { metal: 30 * speed, crystal: 15 * speed, deuterium: 0 };
    for (const k of KEYS) {
      const b = base(p, k, speed);
      p.mult[k] = b > 0 ? Math.max(1, (body.production[k] - flat[k]) / b) : 1;
    }
    state.push(p);
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
  const scale = () => (count + extra) / count;
  /** The mines' base output of the whole account, per resource. */
  const accountBase = () => {
    const out = zero();
    for (const p of state) for (const k of KEYS) out[k] += base(p, k, speed);
    return out;
  };
  /** A share of the base output added on every planet (account-wide research). */
  const addEverywhere = (share: Resources) => {
    for (const p of state)
      for (const k of KEYS) {
        p.mult[k] += share[k];
        p.production[k] += base(p, k, speed) * share[k];
      }
  };
  const plasmaDiscount = () => {
    let d = 0;
    const row = LF_RESEARCH_BONUS[PLASMA_DISCOUNT]!;
    for (const p of state) if (p.research.some((r) => r.id === PLASMA_DISCOUNT)) d += row[0] * lvl(p, PLASMA_DISCOUNT) * researchFactor(p, PLASMA_DISCOUNT, lfLevels);
    return capped(row, 0, d);
  };
  const where = (p: PlanetState) => ({ planetId: p.input.id, name: p.input.name, coords: p.input.coords });

  const out: AmortStep[] = [];
  for (let i = 0; i < steps; i++) {
    let best: AmortStep | null = null;
    const consider = (s: Omit<AmortStep, 'days'>) => {
      if (exclude.includes(s.kind === 'mine' ? s.mine! : s.kind)) return;
      const d = days(s.cost, s.gain, rates);
      if (Number.isFinite(d) && (!best || d < best.days)) best = { ...s, days: d };
    };
    const all = accountBase();
    for (const p of state) {
      for (const k of KEYS) {
        const id = MINE_ID[k];
        const L = lvl(p, id);
        const gain = zero();
        gain[k] = (base(p, k, speed, L + 1) - base(p, k, speed, L)) * p.mult[k];
        consider({ kind: 'mine', id, mine: k, ...where(p), from: L, to: L + 1, cost: levelCost(id, L + 1, discount(p, id)), gain });
      }
      for (const id of LF_PRODUCTION_BUILDINGS) {
        if (speciesOf(id) !== p.species) continue;
        const L = lvl(p, id);
        if (!open(lfLocked, p.input.id, id, L)) continue;
        const gain = zero();
        KEYS.forEach((k, c) => (gain[k] = (building(p, id, c as 0 | 1 | 2, L + 1) - building(p, id, c as 0 | 1 | 2, L)) * base(p, k, speed)));
        consider({ kind: 'lfBuilding', id, ...where(p), from: L, to: L + 1, cost: levelCost(id, L + 1, discount(p, id)), gain });
      }
      // Research boosters: every production research on this planet gets stronger.
      const boostersNow = LF_RESEARCH_BOOSTERS.reduce((s, [b, c]) => s + building(p, b, c), 0);
      for (const [id, column] of LF_RESEARCH_BOOSTERS) {
        if (speciesOf(id) !== p.species) continue;
        const L = lvl(p, id);
        if (!open(lfLocked, p.input.id, id, L)) continue;
        const boostersNext = boostersNow - building(p, id, column) + building(p, id, column, L + 1);
        const gain = zero();
        for (const r of p.research) {
          const row = LF_RESEARCH_BONUS[r.id];
          if (!row || !LF_PRODUCTION_RESEARCH.includes(r.id)) continue;
          const delta = researchFactor(p, r.id, lfLevels, boostersNext) - researchFactor(p, r.id, lfLevels, boostersNow);
          KEYS.forEach((k, c) => (gain[k] += (row[c] ?? 0) * lvl(p, r.id) * delta * all[k] * scale()));
        }
        consider({ kind: 'lfBuilding', id, ...where(p), from: L, to: L + 1, cost: levelCost(id, L + 1, discount(p, id)), gain });
      }
      for (const r of p.research) {
        const row = LF_RESEARCH_BONUS[r.id];
        if (!row || !LF_PRODUCTION_RESEARCH.includes(r.id)) continue;
        const L = lvl(p, r.id);
        if (!open(lfLocked, p.input.id, r.id, L)) continue;
        const f = researchFactor(p, r.id, lfLevels);
        const gain = zero();
        KEYS.forEach((k, c) => (gain[k] = (row[c] ?? 0) * f * all[k] * scale()));
        consider({ kind: 'lfResearch', id: r.id, ...where(p), from: L, to: L + 1, cost: levelCost(r.id, L + 1, discount(p, r.id)), gain, guessed: r.guessed });
      }
    }
    const plasmaGain = zero();
    for (const k of KEYS) plasmaGain[k] = all[k] * PLASMA_RATE[k] * scale();
    consider({ kind: 'plasma', id: PLASMA, from: plasma, to: plasma + 1, cost: levelCost(PLASMA, plasma + 1, plasmaDiscount()), gain: plasmaGain });
    // A new slot comes with every odd level of astrophysics.
    const next = astro % 2 === 1 ? astro + 2 : astro + 1;
    const avg = zero();
    for (const p of state) for (const k of KEYS) avg[k] += p.production[k] / count;
    consider({ kind: 'astro', id: ASTRO, from: astro, to: next, cost: addCost(rangeCost(ASTRO, astro + 1, next), colonyCost), gain: avg });

    const step = best as AmortStep | null;
    if (!step) break;
    out.push(step);
    const p = state.find((x) => x.input.id === step.planetId);
    if (step.kind === 'mine' && p) {
      p.levels[String(step.id)] = step.to;
      p.production[step.mine!] += step.gain[step.mine!];
    } else if (step.kind === 'lfBuilding' && p) {
      const share = zero();
      KEYS.forEach((k, c) => (share[k] = building(p, step.id, c as 0 | 1 | 2, step.to) - building(p, step.id, c as 0 | 1 | 2, step.from)));
      p.levels[String(step.id)] = step.to;
      if (LF_PRODUCTION_BUILDINGS.includes(step.id)) {
        for (const k of KEYS) {
          p.mult[k] += share[k];
          p.production[k] += base(p, k, speed) * share[k];
        }
      } else {
        // A research booster: its gain was computed for the whole account.
        addEverywhere({ metal: step.gain.metal / all.metal || 0, crystal: step.gain.crystal / all.crystal || 0, deuterium: step.gain.deuterium / all.deuterium || 0 });
      }
    } else if (step.kind === 'lfResearch' && p) {
      p.levels[String(step.id)] = step.to;
      addEverywhere({ metal: step.gain.metal / all.metal || 0, crystal: step.gain.crystal / all.crystal || 0, deuterium: step.gain.deuterium / all.deuterium || 0 });
    } else if (step.kind === 'plasma') {
      plasma = step.to;
      addEverywhere(PLASMA_RATE);
    } else if (step.kind === 'astro') {
      astro = step.to;
      extra++;
    }
  }
  return out;
}

/** Planets with a production building of their species at level 0 whose lifeform buildings page was never opened. */
export function lfBuildingsMissing(snapshot: AccountSnapshot | null, lfLocked: LfLocked = {}): number[] {
  if (!snapshot) return [];
  const ids = [...LF_PRODUCTION_BUILDINGS, ...LF_RESEARCH_BOOSTERS.map(([id]) => id)];
  return snapshot.bodies
    .filter((b) => b.type === 'planet' && b.species && !lfLocked[String(b.id)]?.b && ids.some((id) => speciesOf(id) === b.species && !(b.levels[String(id)] ?? 0)))
    .map((b) => b.id);
}

/** Planets whose lifeform research slots are still a guess: their research page has not been opened. */
export function lfSlotsMissing(snapshot: AccountSnapshot | null, lfSlots: LfSlots = {}): number[] {
  if (!snapshot) return [];
  return snapshot.bodies
    .filter((b) => b.type === 'planet' && !lfSlots[String(b.id)] && activeLfResearch(b).length > 0)
    .map((b) => b.id);
}
