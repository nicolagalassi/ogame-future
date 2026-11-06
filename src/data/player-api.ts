/**
 * Points and ranks of a player from the universe's public API (`/api/playerData.xml?id=`),
 * the same file OGLight reads for its galaxy tooltips.
 *
 * COMPLIANCE (AGENTS.md §4, §6): asked only when the player points at someone in the galaxy view
 * (reason 'user-view', public API only, no cookies), and cached: the file changes about once an
 * hour, so the same player is never asked twice within that hour.
 */
import type { NetworkGuard } from '../core/guard';
import type { Store } from '../core/storage';
import { recordPoints, RIVAL_POINTS_KEY, RIVALS_KEY, type Rival, type RivalPoints } from '../engines/rivals';

export const PLAYER_SCORES_KEY = 'galaxy.players';
const TTL = 60 * 60 * 1000;
const KEEP = 400;

/** Highscore types of the public API. */
export const SCORE_TYPES = { total: 0, economy: 1, research: 2, military: 3, lifeform: 8 } as const;
export type ScoreType = keyof typeof SCORE_TYPES;

export interface PlayerScores {
  id: number;
  name: string;
  /** When Future read it (cache age). */
  at: number;
  scores: Partial<Record<ScoreType, { points: number; rank: number }>>;
  /** Ships counted in the military score. */
  ships: number | null;
}

/** Parses playerData.xml; null when the answer is not a player (unknown id, error page). */
export function parsePlayerData(xml: string, now: number): PlayerScores | null {
  // Parsed as HTML, like OGLight: tag names become lowercase and a malformed answer still parses.
  const doc = new DOMParser().parseFromString(xml, 'text/html');
  const root = doc.querySelector('playerdata');
  const id = Number(root?.getAttribute('id'));
  if (!root || !id) return null;
  const scores: PlayerScores['scores'] = {};
  for (const [key, type] of Object.entries(SCORE_TYPES) as [ScoreType, number][]) {
    const pos = root.querySelector(`positions position[type="${type}"]`);
    const points = Number(pos?.getAttribute('score'));
    const rank = Number(pos?.textContent?.trim());
    if (pos && Number.isFinite(points) && Number.isFinite(rank)) scores[key] = { points: Math.floor(points), rank };
  }
  const ships = Number(root.querySelector('positions position[type="3"]')?.getAttribute('ships'));
  return { id, name: root.getAttribute('name') ?? '', at: now, scores, ships: Number.isFinite(ships) && ships > 0 ? ships : null };
}

/** The cached scores if younger than an hour, else asks the API once and caches the answer. */
export async function playerScores(guard: NetworkGuard, store: Store, origin: string, id: number, now: number): Promise<PlayerScores | null> {
  const cache = store.get<Record<string, PlayerScores>>(PLAYER_SCORES_KEY, {});
  const hit = cache[String(id)];
  if (hit && now - hit.at < TTL) return hit;
  const res = await guard.request(`${origin}/api/playerData.xml?id=${id}`, 'user-view');
  if (!res.ok) return hit ?? null;
  const fresh = parsePlayerData(await res.text(), now);
  if (!fresh) return hit ?? null;
  cache[String(id)] = fresh;
  // Points over time, for rivals and the player only (the dashboard's rivals tab).
  const own = Number(store.namespace.split(':').pop());
  if (id === own || store.get<Rival[]>(RIVALS_KEY, []).some((r) => r.id === id)) store.set(RIVAL_POINTS_KEY, recordPoints(store.get<RivalPoints>(RIVAL_POINTS_KEY, {}), fresh));
  // Keep the most recent players only.
  const ids = Object.keys(cache).sort((a, b) => (cache[b]?.at ?? 0) - (cache[a]?.at ?? 0));
  for (const old of ids.slice(KEEP)) delete cache[old];
  store.set(PLAYER_SCORES_KEY, cache);
  return fresh;
}
