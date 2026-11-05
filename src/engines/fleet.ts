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
  reserve: Reserve;
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
