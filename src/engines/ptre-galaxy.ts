/**
 * What a galaxy system the game drew tells the team's PTRE, built as OGLight builds it (OGLight 5.4.2,
 * `ptrePositions` / `ptreActivities`):
 * - positions: a planet or a moon that appeared, changed or went since Future last saw that system (the
 *   first time a system is seen, every occupied position counts as new, as in OGLight);
 * - activities: the activity of the players the player follows (a flag, or opened lately), position by position.
 * Also: PTRE's planets of one player back into Future's position memory, and counter-espionage reports.
 *
 * Pure functions over data already read: no DOM, no network.
 * COMPLIANCE (AGENTS.md §1.9): only sent when the player turned on «Send while playing» (data/ptre).
 */
import type { Activity, GalaxyRow, PlayerStatus } from '../data/galaxy';
import type { Positions } from './positions';

/** Planet and moon ids Future last saw per position: "g:s" → position → [owner, planet id, moon id]. */
export type GalaxyIds = Record<string, Record<string, [number, number, number]>>;
export const GALAXY_IDS_KEY = 'ptre.galaxyIds';
/** Systems remembered at most (the oldest go first). */
const IDS_MAX = 3000;

/** The status letter OGLight sends for a player (its `playerStatus` table). */
const STATUS_TAGS: [PlayerStatus, string][] = [
  ['vacation', 'v'], ['banned', 'b'], ['admin', 'a'], ['longinactive', 'I'], ['inactive', 'i'], ['outlaw', 'o'], ['noob', 'd'], ['honorableTarget', 'HONORABLE'],
];
export const statusTag = (statuses: PlayerStatus[]): string => STATUS_TAGS.find(([s]) => statuses.includes(s))?.[1] ?? 'n';

/** Activity as OGLight sends it: '*' within 15 minutes, else the minutes, 60 when none shown. */
const acti = (a: Activity): '*' | number => (a === '*' ? '*' : a ?? 60);

export type SystemRow = Pick<GalaxyRow, 'position' | 'planetId' | 'moonId' | 'playerId' | 'playerName' | 'statuses' | 'rank' | 'activity'> & { debris: number };

export interface SystemRead {
  galaxy: number;
  system: number;
  rows: SystemRow[];
}

export interface GalaxyContext {
  teamKey: string;
  /** Time of the reading (ms). */
  now: number;
  /** Players whose activity goes to PTRE: flagged, or opened lately. */
  follow: (playerId: number) => boolean;
  /** True for a player's first planet (home), when Future knows it. */
  home: (coords: string) => boolean;
  /** A player's total and military points, when Future knows them. */
  scores: (playerId: number) => { score: number; fleet: number } | null;
}

export interface GalaxyPayloads {
  positions: Record<string, Record<string, unknown>>;
  activities: Record<string, Record<string, unknown>>;
  /** The ids memory with this system as just seen. */
  ids: GalaxyIds;
  /** False when the system looks as Future last saw it (the memory needs no write). */
  changed: boolean;
}

export function galaxyPayloads(s: SystemRead, memory: GalaxyIds, c: GalaxyContext): GalaxyPayloads {
  const key = `${s.galaxy}:${s.system}`;
  const before = memory[key] ?? {};
  const seen: Record<string, [number, number, number]> = {};
  const positions: GalaxyPayloads['positions'] = {};
  const activities: GalaxyPayloads['activities'] = {};
  const byPos = new Map(s.rows.map((r) => [r.position, r]));
  for (let p = 1; p <= 15; p++) {
    const coords = `${key}:${p}`;
    const r = byPos.get(p);
    const old = before[String(p)] ?? [-1, -1, -1];
    // Game administrators: left out, as OGLight leaves them out.
    if (r?.statuses.includes('admin')) {
      if (before[String(p)]) seen[String(p)] = before[String(p)]!;
      continue;
    }
    const player = r?.playerId && r.planetId ? r.playerId : -1;
    if (!r || player < 0) {
      // Occupied before, empty now: the team learns it went.
      if (old[1] > 0) positions[coords] = { ...base(c, s, p, old), id: -1, player_id: -1, name: false, rank: -1, score: -1, fleet: -1, status: false, moon: { id: -1 } };
      continue;
    }
    const planet = r.planetId!;
    const moon = r.moonId ?? -1;
    seen[String(p)] = [player, planet, moon];
    if (old[1] !== planet || old[2] !== moon) {
      const sc = c.scores(player);
      positions[coords] = {
        ...base(c, s, p, old), id: planet, player_id: player, name: r.playerName || false, rank: r.rank ?? -1, score: sc?.score ?? -1, fleet: sc?.fleet ?? -1, status: statusTag(r.statuses),
        // OGLight also sends the moon's size; the galaxy table Future reads does not show it.
        ...(moon > 0 ? { moon: { id: moon, size: -1 } } : {}),
      };
    }
    if (c.follow(player)) {
      activities[coords] = {
        id: planet, player_id: player, teamkey: c.teamKey, mv: r.statuses.includes('vacation'), activity: acti(r.activity.planet), galaxy: s.galaxy, system: s.system, position: p,
        main: c.home(coords), cdr_total_size: r.debris,
        ...(moon > 0 ? { moon: { id: moon, activity: acti(r.activity.moon) } } : {}),
      };
    }
  }
  const changed = JSON.stringify(seen) !== JSON.stringify(memory[key] ?? null);
  const ids: GalaxyIds = { ...memory };
  delete ids[key];
  ids[key] = seen;
  // Newest last (insertion order): past the limit the systems seen longest ago are forgotten.
  const keys = Object.keys(ids);
  for (const k of keys.slice(0, Math.max(0, keys.length - IDS_MAX))) delete ids[k];
  return { positions, activities, ids, changed };
}

/** The fields every position entry carries (what Future knew of the position before). */
const base = (c: GalaxyContext, s: SystemRead, position: number, old: [number, number, number]) => ({
  teamkey: c.teamKey, galaxy: s.galaxy, system: s.system, position, timestamp_ig: c.now,
  old_player_id: old[0], timestamp_api: -1, old_name: false, old_rank: -1, old_score: -1, old_fleet: -1,
});

/** One counter-espionage report as OGLight sends it to PTRE's activity database (keyed by message id). */
export function counterSpyPayload(m: { at: number; sourceId: number; sourceCoords: string }, teamKey: string): Record<string, unknown> | null {
  const [galaxy, system, position] = m.sourceCoords.split(':').map(Number);
  if (!(m.sourceId > 0) || !galaxy || !system || !position) return null;
  return { player_id: m.sourceId, teamkey: teamKey, galaxy, system, position, spy_message_ts: m.at, moon: { activity: '*' }, activity: '*' };
}

export interface PtrePlanet {
  coords: string;
  playerId: number;
  moon: boolean;
  /** When a team member saw it (ms). */
  at: number;
}

/**
 * A player's planets known to the team, into Future's position memory: a position PTRE saw more recently
 * than Future takes PTRE's owner and moon (activity unknown), as OGLight takes them into its own.
 */
export function mergePtrePlanets(db: Positions, planets: PtrePlanet[]): Positions | null {
  let next: Positions | null = null;
  for (const p of planets) {
    const mine = db[p.coords];
    if (!/^\d+:\d+:\d+$/.test(p.coords) || !(p.playerId > 0) || !(p.at > 0) || (mine && mine.at >= p.at)) continue;
    next ??= { ...db };
    next[p.coords] = { player: p.playerId, name: mine?.player === p.playerId ? mine.name : '', moon: p.moon, debris: mine?.debris ?? 0, act: [null, null], at: p.at };
  }
  return next;
}
