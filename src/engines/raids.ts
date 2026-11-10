/**
 * Spy board: the newest espionage report per target, and how much each target is worth per
 * hour of flight from the player's nearest planet or moon. Pure functions: no DOM, no network.
 *
 * Flight maths as the game (and OGLight) do it: distance by galaxy / system / position,
 * duration = 10 + 3500 * (100 / percent) * sqrt(10 * distance / speed), divided by the fleet speed
 * (checked against the game's own fleetHelper.calcDuration on 2026-11-06).
 */
import type { SpyMessage } from '../data/messages';

export interface SpyEntry {
  /** "g:s:p" plus ":m" for a moon. */
  key: string;
  id: string;
  at: number;
  coords: string;
  moon: boolean;
  playerId: number;
  playerName: string;
  statuses: string[];
  /** Minutes since last activity, 0 = active now, 60 = none seen. */
  activity: number;
  res: { metal: number; crystal: number; deuterium: number };
  loot: number;
  fleetValue: number;
  defValue: number;
  /** API key of the report, for the simulators ('' in entries saved before 2026-11-06). */
  apiKey?: string;
  /** Read from Communication › shared espionage reports: an alliance member's probe, not yours. */
  shared?: boolean;
}

export type SpyBoard = Record<string, SpyEntry>;

export const SPY_BOARD_KEY = 'spy.board';
/** Reports older than this leave the board: the target has moved on. */
export const SPY_MAX_AGE = 72 * 3_600_000;

export const spyKey = (coords: string, moon: boolean) => `${coords}${moon ? ':m' : ''}`;

/** Adds reports (newest per target wins), drops old ones. Returns how many entries changed. */
export function rememberSpies(board: SpyBoard, reports: SpyMessage[], now: number, shared = false): number {
  let changed = 0;
  for (const r of reports) {
    if (r.counter || !r.playerId) continue;
    const key = spyKey(r.coords, r.moon);
    const known = board[key];
    // The same report met again in the shared tab: it was an alliance member's probe.
    if (known && known.id === r.id && shared && !known.shared) {
      known.shared = true;
      changed++;
    }
    // Same report seen again: skip, unless the stored copy predates the API key.
    if (known && (known.at > r.at || (known.at === r.at && (known.apiKey || !r.apiKey)))) continue;
    board[key] = {
      key, id: r.id, at: r.at, coords: r.coords, moon: r.moon, playerId: r.playerId, playerName: r.playerName, statuses: r.statuses,
      activity: r.activity, res: { metal: r.res.metal, crystal: r.res.crystal, deuterium: r.res.deuterium }, loot: r.loot, fleetValue: r.fleetValue, defValue: r.defValue, apiKey: r.apiKey,
      ...(shared ? { shared: true } : {}),
    };
    changed++;
  }
  for (const [key, e] of Object.entries(board)) if (now - e.at > SPY_MAX_AGE) { delete board[key]; changed++; }
  return changed;
}

export interface Universe {
  galaxies: number;
  systems: number;
  donutGalaxy: boolean;
  donutSystem: boolean;
  /** Fleet speed factor for attacks ("war" speed). */
  fleetSpeed: number;
}

const parse = (coords: string) => coords.split(':').map(Number) as [number, number, number];
const ring = (d: number, size: number, donut: boolean) => (donut ? Math.min(d, size - d) : d);

export function distance(from: string, to: string, u: Universe): number {
  const [g1, s1, p1] = parse(from);
  const [g2, s2, p2] = parse(to);
  if (g1 !== g2) return 20_000 * ring(Math.abs(g1 - g2), u.galaxies, u.donutGalaxy);
  if (s1 !== s2) return 2_700 + 95 * ring(Math.abs(s1 - s2), u.systems, u.donutSystem);
  if (p1 !== p2) return 1_000 + 5 * Math.abs(p1 - p2);
  return 5;
}

/** One-way flight in seconds at `percent` (10..100) with the slowest ship's `speed`. */
export function flightSeconds(dist: number, speed: number, u: Universe, percent = 100): number {
  return Math.round((10 + 3500 * (100 / percent) * Math.sqrt((10 * dist) / speed)) / u.fleetSpeed);
}

export interface Base {
  id: number;
  name: string;
  coords: string;
  moon: boolean;
}

/** The player's planet or moon closest to `coords`. */
export function nearestBase(bases: Base[], coords: string, u: Universe): { base: Base | null; dist: number } {
  let base: Base | null = null;
  let dist = Infinity;
  for (const b of bases) {
    const d = distance(b.coords, coords, u);
    if (d < dist) { dist = d; base = b; }
  }
  return { base, dist };
}

export interface TargetRow {
  entry: SpyEntry;
  /** Resources the attack can take. */
  lootRes: number;
  /** The same in MSU (3:2:1 → metal 1, crystal 1.5, deuterium 3). */
  lootMsu: number;
  ships: number;
  base: Base | null;
  /** One-way seconds from the base, null when the ship speed is unknown. */
  flight: number | null;
  /** Loot MSU per hour of the round trip, null when the flight time is unknown. */
  msuPerHour: number | null;
  ageMinutes: number;
}

/** Rows for the board: loot, cargo ships needed, nearest base and value per hour of flight. */
export function targetRows(board: SpyBoard, bases: Base[], o: { capacity: number; speed: number; universe: Universe; now: number }): TargetRow[] {
  return Object.values(board).map((entry) => {
    const lootRes = Math.floor((entry.res.metal + entry.res.crystal + entry.res.deuterium) * entry.loot);
    const lootMsu = (entry.res.metal + entry.res.crystal * 1.5 + entry.res.deuterium * 3) * entry.loot;
    const { base, dist } = nearestBase(bases, entry.coords, o.universe);
    const flight = base && o.speed > 0 ? flightSeconds(dist, o.speed, o.universe) : null;
    return {
      entry,
      lootRes,
      lootMsu,
      ships: o.capacity > 0 ? Math.ceil(lootRes / o.capacity) : 0,
      base,
      flight,
      msuPerHour: flight ? lootMsu / ((2 * flight) / 3600) : null,
      ageMinutes: Math.max(0, Math.round((o.now - entry.at) / 60_000)),
    };
  });
}
