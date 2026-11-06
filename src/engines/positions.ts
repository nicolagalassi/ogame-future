/**
 * Positions Future has seen in the galaxy view, as OGLight keeps them: who owns each planet, the
 * moon, the debris and the activity, with the time of the reading. The public API lists a player's
 * planets only once a week; this memory adds the colonies seen since and drops the ones gone.
 *
 * Kept only for the positions the player cares about (marked or lately opened players, coloured
 * planets) and for the ones already kept, so that an emptied position is noticed.
 * Pure functions over Future's own data: no DOM, no network.
 */
import type { Activity } from '../data/galaxy';

export interface Seen {
  /** Owner's id when last seen; 0 = the position was empty. */
  player: number;
  /** Planet name. */
  name: string;
  moon: boolean;
  /** Debris on the position: metal + crystal + deuterium. */
  debris: number;
  /** Activity of the planet and of the moon. */
  act: [Activity, Activity];
  at: number;
}

export type Positions = Record<string, Seen>;

export const POSITIONS_KEY = 'positions';
const MAX = 4000;

export interface SeenRow {
  position: number;
  playerId: number | null;
  planetId: number | null;
  planetName: string;
  moonId: number | null;
  debris: number;
  activity: { planet: Activity; moon: Activity };
}

/**
 * Takes the system on screen into the memory. `keep` says which owners or positions are worth keeping.
 * Returns null when nothing changed (no write needed).
 */
export function recordSystem(db: Positions, galaxy: number, system: number, rows: SeenRow[], keep: (playerId: number, coords: string) => boolean, now: number): Positions | null {
  let next: Positions | null = null;
  const put = (coords: string, seen: Seen | null) => {
    next ??= { ...db };
    if (seen) next[coords] = seen;
    else delete next[coords];
  };
  const byPos = new Map(rows.map((r) => [r.position, r]));
  for (let p = 1; p <= 15; p++) {
    const coords = `${galaxy}:${system}:${p}`;
    const r = byPos.get(p);
    const owner = r?.planetId && r.playerId ? r.playerId : 0;
    if (owner && (keep(owner, coords) || db[coords])) {
      put(coords, { player: owner, name: r!.planetName, moon: !!r!.moonId, debris: Math.round(r!.debris), act: [r!.activity.planet, r!.moonId ? r!.activity.moon : null], at: now });
    } else if (!owner && db[coords]) {
      // Emptied (or destroyed): remembered as empty until the API stops listing it.
      if (db[coords]!.player) put(coords, { player: 0, name: '', moon: false, debris: Math.round(r?.debris ?? 0), act: [null, null], at: now });
    }
  }
  if (!next) return null;
  const all: Positions = next;
  const keys = Object.keys(all);
  if (keys.length > MAX) for (const k of keys.sort((a, b) => all[a]!.at - all[b]!.at).slice(0, keys.length - MAX)) delete all[k];
  return all;
}

export interface PlanetLine {
  coords: string;
  name: string;
  moon: boolean;
  /** The galaxy reading, when Future has one for this owner. */
  seen: Seen | null;
  /** True when only the galaxy view knows it (newer than the API). */
  fresh: boolean;
}

export const coordsValue = (c: string): number => c.split(':').reduce((s, n) => s * 1000 + Number(n), 0);

/**
 * A player's planets: the API list, minus the positions the galaxy has since shown empty or owned by
 * someone else, plus the ones the galaxy has shown and the API does not list yet. In coordinate order.
 */
export function planetsOf(id: number, api: { at: number; updated?: number; planets?: { coords: string; name: string; moon: unknown }[] } | null, db: Positions): PlanetLine[] {
  const out = new Map<string, PlanetLine>();
  const apiAt = api?.updated ?? api?.at ?? 0;
  for (const p of api?.planets ?? []) {
    const seen = db[p.coords];
    if (seen && seen.player !== id && seen.at > apiAt) continue;
    out.set(p.coords, { coords: p.coords, name: seen?.player === id ? seen.name || p.name : p.name, moon: seen?.player === id && seen.at > apiAt ? seen.moon : !!p.moon, seen: seen?.player === id ? seen : null, fresh: false });
  }
  for (const [coords, seen] of Object.entries(db)) {
    if (seen.player === id && !out.has(coords)) out.set(coords, { coords, name: seen.name, moon: seen.moon, seen, fresh: true });
  }
  return [...out.values()].sort((a, b) => coordsValue(a.coords) - coordsValue(b.coords));
}

/** Short age of a reading: "5m", "3h", "2g" (the unit letters come from the caller). */
export function ageParts(ms: number): { n: number; unit: 'm' | 'h' | 'd' } {
  const min = Math.max(0, Math.floor(ms / 60_000));
  if (min < 60) return { n: min, unit: 'm' };
  if (min < 48 * 60) return { n: Math.floor(min / 60), unit: 'h' };
  return { n: Math.floor(min / 1440), unit: 'd' };
}
