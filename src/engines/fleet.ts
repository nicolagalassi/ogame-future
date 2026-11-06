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
  /**
   * Kept by transports, deployments, "all ships", "last fleet" and planner deliveries.
   * Ships and resources are two separate rules, each with its own switch (FleetSettings).
   */
  reserve: Reserve;
  /** Ships kept home by the jump gate dialog (moons). Absent in old saves: see profileFor. */
  gate?: Record<string, number>;
  /** Kept by the fleetsave only, ships and resources together; it ignores the switches. */
  saveReserve?: Reserve;
  save: FleetsaveProfile | null;
}

export const EMPTY_RESERVE: Reserve = { ships: {}, resources: { metal: 0, crystal: 0, deuterium: 0 } };
export const PROFILES_KEY = 'fleet.profiles';

/**
 * The stored profile of a body, always complete. Before the jump gate had its own rule it
 * kept the ships of the main reserve: a profile saved back then keeps doing so.
 */
export function profileFor(profiles: Record<string, FleetProfile>, bodyId: number): Required<FleetProfile> {
  const p = profiles[String(bodyId)] ?? { reserve: structuredClone(EMPTY_RESERVE), save: null };
  return { ...p, gate: p.gate ?? { ...p.reserve.ships }, saveReserve: p.saveReserve ?? structuredClone(EMPTY_RESERVE) };
}

/** What the switches leave of a profile: an off rule keeps nothing back. The fleetsave ignores them. */
export function activeProfile(p: Required<FleetProfile>, s: Pick<FleetSettings, 'shipsOn' | 'resourcesOn' | 'gateOn'>): Required<FleetProfile> {
  return {
    ...p,
    reserve: { ships: s.shipsOn ? p.reserve.ships : {}, resources: s.resourcesOn ? p.reserve.resources : { ...EMPTY_RESERVE.resources } },
    gate: s.gateOn ? p.gate : {},
  };
}

/** The parts of a profile that are shown, switched and copied one by one. */
export type ReserveSection = 'ships' | 'resources' | 'gate' | 'fleetsave';
export const RESERVE_SECTIONS: ReserveSection[] = ['ships', 'resources', 'gate', 'fleetsave'];

const positive = (ships: Record<string, number>) => Object.fromEntries(Object.entries(ships).filter(([, n]) => n > 0));

function sectionValue(p: Required<FleetProfile>, section: ReserveSection): unknown {
  switch (section) {
    case 'ships':
      return positive(p.reserve.ships);
    case 'resources':
      return p.reserve.resources;
    case 'gate':
      return positive(p.gate);
    case 'fleetsave':
      return { save: p.save, ships: positive(p.saveReserve.ships), resources: p.saveReserve.resources };
  }
}

/** JSON with sorted keys, so two equal rules compare equal whatever order they were typed in. */
function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
  return `{${Object.keys(v)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
    .join(',')}}`;
}

/** True when the rule keeps nothing back (fleetsave: no target and no reserve). */
export function sectionEmpty(p: Required<FleetProfile>, section: ReserveSection): boolean {
  const v = sectionValue(p, section) as Record<string, unknown>;
  if (section === 'resources') return !Object.values(v).some(Boolean);
  if (section === 'fleetsave') return v.save === null && canonical({ ships: v.ships, resources: v.resources }) === canonical({ ships: {}, resources: EMPTY_RESERVE.resources });
  return Object.keys(v).length === 0;
}

/** The other bodies whose rule is the same as this body's. */
export function sameSection(profiles: Record<string, FleetProfile>, fromId: number, ids: number[], section: ReserveSection): number[] {
  const mine = canonical(sectionValue(profileFor(profiles, fromId), section));
  return ids.filter((id) => id !== fromId && canonical(sectionValue(profileFor(profiles, id), section)) === mine);
}

/** Copies the chosen rules of one body onto the chosen bodies, leaving their other rules alone. */
export function copySections(profiles: Record<string, FleetProfile>, fromId: number, ids: number[], sections: ReserveSection[]): Record<string, FleetProfile> {
  const src = structuredClone(profileFor(profiles, fromId));
  const out = { ...profiles };
  for (const id of ids) {
    if (id === fromId) continue;
    const p = structuredClone(profileFor(profiles, id));
    if (sections.includes('ships')) p.reserve.ships = { ...src.reserve.ships };
    if (sections.includes('resources')) p.reserve.resources = { ...src.reserve.resources };
    if (sections.includes('gate')) p.gate = { ...src.gate };
    if (sections.includes('fleetsave')) {
      p.save = structuredClone(src.save);
      p.saveReserve = structuredClone(src.saveReserve);
    }
    out[String(id)] = p;
  }
  return out;
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
  /** Each rule on or off, without forgetting it: ships, resources, jump gate. Not the fleetsave's. */
  shipsOn: boolean;
  resourcesOn: boolean;
  gateOn: boolean;
  /** Food stays home in every fleet, also with the game's own buttons (OGLight precedent). */
  ignoreFood: boolean;
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
  shipsOn: true,
  resourcesOn: true,
  gateOn: true,
  ignoreFood: false,
};

/** Stored settings with the defaults; the old single "reserves" switch becomes the ships and resources ones. */
export function settingsFrom(stored: Partial<FleetSettings> & { reserveOn?: boolean }): FleetSettings {
  const { reserveOn, ...rest } = stored;
  const legacy = reserveOn === undefined ? {} : { shipsOn: reserveOn, resourcesOn: reserveOn };
  return { ...DEFAULT_SETTINGS, ...legacy, ...rest };
}

/** Resources still to bring to a planned body (planner "Porta risorse"). */
export interface Delivery {
  target: number;
  need: Resources;
}
export const DELIVERY_KEY = 'plan.delivery';

/** What one source body sends: what is still needed, within what it has after the reserve. */
export function deliveryLoad(onPlanet: Resources, reserve: Reserve, fuel: number, capacity: number, need: Resources): Resources {
  // Whole units only: the game's own number formatting turns 1234.5 into "1.234.5".
  const free = resourcesAfterReserve(onPlanet, reserve, fuel);
  let room = Math.max(0, Math.floor(capacity));
  const take = (a: number, b: number) => Math.max(0, Math.floor(Math.min(a, b, room)));
  const deuterium = take(free.deuterium, Math.ceil(need.deuterium));
  room -= deuterium;
  const crystal = take(free.crystal, Math.ceil(need.crystal));
  room -= crystal;
  const metal = take(free.metal, Math.ceil(need.metal));
  return { metal, crystal, deuterium };
}

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
  const deuterium = Math.max(0, Math.floor(Math.min(free.deuterium, room)));
  room -= deuterium;
  const crystal = Math.max(0, Math.floor(Math.min(free.crystal, room)));
  room -= crystal;
  const metal = Math.max(0, Math.floor(Math.min(free.metal, room)));
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
export function expeditionMax(o: {
  topScore?: number;
  characterClass: number;
  economySpeed: number;
  classBooster: number;
  /** Lifeform expedition resource bonus (0.92 = +92%). */
  lfBooster?: number;
  /** Active expedition amplifier items, summed (0.4 = +40%). */
  itemBoost?: number;
}): { base: number; max: number } {
  const row = EXPEDITION_TABLE.find((r) => r.topScore >= (o.topScore ?? Infinity))!;
  const factor = o.characterClass === 3 ? 3 * o.economySpeed : 2;
  const bonus = (1 + o.classBooster) * (1 + (o.lfBooster ?? 0)) * (1 + (o.itemBoost ?? 0));
  return { base: row.base, max: Math.round(row.max * factor * bonus) };
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
export function nextBody(
  list: BodyRef[],
  current: number,
  opts: { skip?: number | null; onlyWithMoon?: boolean; backwards?: boolean } = {},
): number | null {
  const isMoon = list.some((b) => b.moonId === current);
  const ids = list
    .filter((b) => (isMoon || opts.onlyWithMoon ? b.moonId !== null : b.planetId !== null))
    .map((b) => (isMoon ? b.moonId : b.planetId) as number);
  const i = ids.indexOf(current);
  if (i < 0) return null;
  for (let k = 1; k < ids.length; k++) {
    const step = opts.backwards ? -k : k;
    const id = ids[(((i + step) % ids.length) + ids.length) % ids.length]!;
    if (id !== opts.skip) return id;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Last fleet (for "ripeti ultima flotta")                             */
/* ------------------------------------------------------------------ */

export interface LastFleet {
  ships: Record<string, number>;
  target: { galaxy: number; system: number; position: number; type: number };
  mission: number;
  /** 10..100 */
  speed: number;
}

export const LAST_FLEET_KEY = 'fleet.last';
