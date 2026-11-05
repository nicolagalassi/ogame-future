/**
 * Fleet helpers: per-planet reserves ("limitatori") and fleetsave profiles.
 * Pure functions, no DOM and no network.
 */
import type { Resources } from '../data/account-info';

export interface Reserve {
  /** Ships to always leave on the planet, by ship id. */
  ships: Record<string, number>;
  /** Resources to always leave on the planet. */
  resources: Resources;
}

/** Fleetsave target. Empty galaxy/system = the origin's own (as in PrOGect). */
export interface FleetsaveProfile {
  galaxy: number | null;
  system: number | null;
  position: number;
  /** 1 planet, 2 debris field, 3 moon (OGame codes). */
  type: 1 | 2 | 3;
  mission: number;
  /** 10..100 */
  speed: number;
}

export interface FleetProfile {
  /** Reserve 1: kept by transports, deployments, expeditions, "all ships". */
  reserve: Reserve;
  /** Reserve 2: kept by the fleetsave only (absent = keep nothing back). */
  saveReserve?: Reserve;
  save: FleetsaveProfile | null;
}

export const EMPTY_RESERVE: Reserve = { ships: {}, resources: { metal: 0, crystal: 0, deuterium: 0 } };
export const PROFILES_KEY = 'fleet.profiles';

export function profileFor(profiles: Record<string, FleetProfile>, bodyId: number): FleetProfile {
  return profiles[String(bodyId)] ?? { reserve: structuredClone(EMPTY_RESERVE), save: null };
}

/** Ships to select: everything on the planet minus the reserve, never below 0. */
export function shipsAfterReserve(available: Record<string, number>, reserve: Reserve): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, count] of Object.entries(available)) {
    const n = Math.max(0, count - (reserve.ships[id] ?? 0));
    if (n > 0) out[id] = n;
  }
  return out;
}

/**
 * Resources to load: what is on the planet minus the reserve; deuterium also keeps
 * the flight's fuel. The game itself still caps everything to the free cargo space.
 */
export function resourcesAfterReserve(available: Resources, reserve: Reserve, fuel: number): Resources {
  return {
    metal: Math.max(0, Math.floor(available.metal - reserve.resources.metal)),
    crystal: Math.max(0, Math.floor(available.crystal - reserve.resources.crystal)),
    deuterium: Math.max(0, Math.floor(available.deuterium - fuel - reserve.resources.deuterium)),
  };
}

/** Coordinates of the fleetsave target, filling empty galaxy/system from the origin. */
export function resolveTarget(save: FleetsaveProfile, origin: { galaxy: number; system: number }) {
  return {
    galaxy: save.galaxy ?? origin.galaxy,
    system: save.system ?? origin.system,
    position: save.position,
    type: save.type,
  };
}

/** Parses "1.5M", "250k", "1.000.000", "12000" into a number; invalid = 0. */
export function parseAmount(text: string): number {
  const raw = text.trim().toLowerCase().replace(/\s/g, '');
  const m = raw.match(/^([\d.,]+)([kmg])?$/);
  if (!m) return 0;
  const unit = m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : m[2] === 'g' ? 1e9 : 1;
  let num = m[1]!;
  // With a unit, "," or "." is a decimal mark; without, both are thousands separators.
  num = unit === 1 ? num.replace(/[.,]/g, '') : num.replace(',', '.');
  const value = Number(num) * unit;
  return Number.isFinite(value) ? Math.floor(value) : 0;
}

/** Copies one planet's profile to every other body id. */
export function copyProfileToAll(profiles: Record<string, FleetProfile>, fromId: number, ids: number[]): Record<string, FleetProfile> {
  const src = profileFor(profiles, fromId);
  const out = { ...profiles };
  for (const id of ids) out[String(id)] = structuredClone(src);
  return out;
}

/* ------------------------------------------------------------------ */
/* Global fleet settings (one set for the whole account).              */
/* ------------------------------------------------------------------ */

export interface FleetSettings {
  /** Cargo ship used first for transports (ship id). */
  mainShip: number;
  /** Cargo ship that covers what the main one cannot (ship id, 0 = none). */
  secondShip: number;
  /** Speed for transports and deployments, 10..100. */
  transportSpeed: number;
  /** Favourite destination body id for "Trasporto" and for "Schiera". */
  favTransport: number | null;
  favDeploy: number | null;
  /** Expedition: ship id, 0 = pick the best one available. */
  expeditionShip: number;
  /** Expedition cargo: '' = calculated, '50%' = share of the calculated one, '2000000' = fixed. */
  expeditionValue: string;
  /** Add one big combat ship, one probe and one pathfinder, like OGLight. */
  expeditionExtras: boolean;
  /** After a send from a Future button, open the next planet or moon ready with the same action. */
  repeat: boolean;
}

export const SETTINGS_KEY = 'fleet.settings';
export const DEFAULT_SETTINGS: FleetSettings = {
  mainShip: 203,
  secondShip: 202,
  transportSpeed: 100,
  favTransport: null,
  favDeploy: null,
  expeditionShip: 0,
  expeditionValue: '',
  expeditionExtras: true,
  repeat: false,
};

/** Ships that carry resources, in the order offered to the player. */
export const CARGO_SHIPS = [203, 202, 219, 209, 210];

export interface ShipStock {
  id: number;
  /** Ships available after the reserve. */
  available: number;
  capacity: number;
}

/**
 * Ships needed to carry `amount`: the main ship first, the second one for the rest.
 * Returns ship id → count (only ids with count > 0).
 */
export function cargoShipsFor(amount: number, stock: ShipStock[], main: number, second: number): Record<number, number> {
  const out: Record<number, number> = {};
  let left = Math.max(0, amount);
  for (const id of [main, second]) {
    if (!id || left <= 0) continue;
    const s = stock.find((x) => x.id === id);
    if (!s || s.available <= 0 || s.capacity <= 0) continue;
    const n = Math.min(s.available, Math.ceil(left / s.capacity));
    if (n > 0) {
      out[id] = (out[id] ?? 0) + n;
      left -= n * s.capacity;
    }
  }
  return out;
}

/**
 * What to load: the game's own order (deuterium, crystal, metal), each capped by what is
 * left after the reserve and by the free cargo space. Deuterium also keeps the fuel.
 */
export function cargoLoad(onPlanet: Resources, reserve: Reserve, fuel: number, capacity: number): Resources {
  const free = resourcesAfterReserve(onPlanet, reserve, fuel);
  let room = Math.max(0, Math.floor(capacity));
  const deuterium = Math.min(free.deuterium, room);
  room -= deuterium;
  const crystal = Math.min(free.crystal, room);
  room -= crystal;
  const metal = Math.min(free.metal, room);
  return { metal, crystal, deuterium };
}

/* ------------------------------------------------------------------ */
/* Expeditions                                                         */
/* ------------------------------------------------------------------ */

/** Expedition find limits by the top player's points (same table as OGLight). */
const EXPEDITION_TABLE = [
  { topScore: 10_000, base: 10, max: 40_000 },
  { topScore: 100_000, base: 125, max: 500_000 },
  { topScore: 1_000_000, base: 300, max: 1_200_000 },
  { topScore: 5_000_000, base: 450, max: 1_800_000 },
  { topScore: 25_000_000, base: 600, max: 2_400_000 },
  { topScore: 50_000_000, base: 750, max: 3_000_000 },
  { topScore: 75_000_000, base: 900, max: 3_600_000 },
  { topScore: 100_000_000, base: 1_050, max: 4_200_000 },
  { topScore: Infinity, base: 1_250, max: 5_000_000 },
];

/**
 * Most resources one expedition can bring back. Without the top score we assume the last
 * row (top player over 100M points), which is where almost every running universe is.
 */
export function expeditionMax(o: { topScore?: number; characterClass: number; economySpeed: number; classBooster: number }): { base: number; max: number } {
  const row = EXPEDITION_TABLE.find((r) => r.topScore >= (o.topScore ?? Infinity))!;
  const factor = o.characterClass === 3 ? 3 * o.economySpeed : 2;
  return { base: row.base, max: Math.round(row.max * factor * (1 + o.classBooster)) };
}

/** Applies the player's expedition value: '' = calculated, '50%' = share, number = fixed. */
export function expeditionTarget(calculated: number, value: string): number {
  const v = value.trim();
  if (!v) return calculated;
  if (v.endsWith('%')) return Math.round((calculated * (parseAmount(v.slice(0, -1)) || 0)) / 100);
  return parseAmount(v) || calculated;
}

/** Structure points factor of the base cargo ships, used for the minimum expedition size. */
const EXPEDITION_FACTOR: Record<number, number> = { 202: 1, 203: 3, 219: 5.75 };
/** Biggest combat ship first: one of them makes the expedition fleet count as strong. */
const EXPEDITION_FILLERS = [218, 213, 211, 215, 207, 206, 205, 204];

export function expeditionFleet(
  stock: ShipStock[],
  o: { ship: number; target: number; base: number; extras: boolean },
): Record<number, number> {
  const has = (id: number) => (stock.find((s) => s.id === id)?.available ?? 0) > 0;
  const need = (id: number) => {
    const s = stock.find((x) => x.id === id);
    if (!s || s.capacity <= 0) return Infinity;
    return Math.max(Math.ceil(o.base / (EXPEDITION_FACTOR[id] ?? 1)), Math.ceil(o.target / s.capacity));
  };
  let ship = o.ship;
  if (!ship) {
    // Best ship: the first of pathfinder, large, small cargo that alone covers the target,
    // otherwise the one that carries the most.
    const options = [219, 203, 202].filter(has);
    ship =
      options.find((id) => (stock.find((s) => s.id === id)?.available ?? 0) >= need(id)) ??
      options.sort((a, b) => {
        const cap = (id: number) => {
          const s = stock.find((x) => x.id === id)!;
          return s.available * s.capacity;
        };
        return cap(b) - cap(a);
      })[0] ??
      0;
  }
  const out: Record<number, number> = {};
  if (ship && has(ship)) out[ship] = Math.min(stock.find((s) => s.id === ship)!.available, need(ship));
  if (o.extras) {
    const filler = EXPEDITION_FILLERS.find((id) => id !== ship && has(id));
    if (filler) out[filler] = 1;
    if (ship !== 210 && has(210)) out[210] = 1;
    if (ship !== 219 && has(219)) out[219] = 1;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Repeat: which body comes next                                       */
/* ------------------------------------------------------------------ */

export interface BodyRef {
  planetId: number | null;
  moonId: number | null;
}

/**
 * The body after `current` in the planet list. From a planet: the next planet.
 * From a moon: the next planet that has a moon, on its moon. `skip` (e.g. the transport
 * destination) is jumped over; `onlyWithMoon` keeps planets that have a moon (planet → moon).
 */
export function nextBody(list: BodyRef[], current: number, opts: { skip?: number | null; onlyWithMoon?: boolean } = {}): number | null {
  const isMoon = list.some((b) => b.moonId === current);
  const ids = list
    .filter((b) => (isMoon || opts.onlyWithMoon ? b.moonId !== null : b.planetId !== null))
    .map((b) => (isMoon ? b.moonId : b.planetId) as number);
  const i = ids.indexOf(current);
  if (i < 0) return null;
  for (let k = 1; k < ids.length; k++) {
    const id = ids[(i + k) % ids.length]!;
    if (id !== opts.skip) return id;
  }
  return null;
}
