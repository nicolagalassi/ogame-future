/**
 * Total ranks of every player of the universe, from the public API (`/api/highscore.xml?category=1&type=0`),
 * so the targets list shows up-to-date ranks without opening each player's card.
 *
 * COMPLIANCE (AGENTS.md §4, §6): read when the targets list is shown (the player's click, or the bar
 * restored with the page), reason 'user-view', public API, no cookies; cached an hour: the game
 * updates the file about hourly. Never on a timer.
 */
import type { NetworkGuard } from '../core/guard';
import type { Store } from '../core/storage';

export interface UniverseRanks {
  at: number;
  /** id → [rank, points]. */
  ranks: Record<string, [number, number]>;
}

export const UNIVERSE_RANKS_KEY = 'universe.ranks';
const TTL = 3_600_000;

export function parseHighscoreXml(xml: string, now: number): UniverseRanks | null {
  const doc = new DOMParser().parseFromString(xml, 'text/html');
  const root = doc.querySelector('highscore');
  if (!root) return null;
  const ranks: UniverseRanks['ranks'] = {};
  for (const p of root.querySelectorAll('player')) {
    const id = p.getAttribute('id');
    const rank = Number(p.getAttribute('position'));
    const points = Number(p.getAttribute('score'));
    if (id && rank > 0) ranks[id] = [rank, Number.isFinite(points) ? Math.floor(points) : 0];
  }
  return Object.keys(ranks).length ? { at: now, ranks } : null;
}

/** The cached ranks when younger than an hour; otherwise asks the API once. */
export async function universeRanks(deps: { guard: NetworkGuard; store: Store; origin: string; now?: number }): Promise<UniverseRanks | null> {
  const now = deps.now ?? Date.now();
  const cached = deps.store.get<UniverseRanks | null>(UNIVERSE_RANKS_KEY, null);
  if (cached && now - cached.at < TTL) return cached;
  const res = await deps.guard.request(`${deps.origin}/api/highscore.xml?category=1&type=0`, 'user-view');
  const fresh = res.ok ? parseHighscoreXml(await res.text(), now) : null;
  if (!fresh) return cached;
  deps.store.set(UNIVERSE_RANKS_KEY, fresh);
  return fresh;
}
