/**
 * Name and status of every player of the universe, from the public API (`/api/players.xml`).
 *
 * COMPLIANCE (AGENTS.md §4, §6): read only when the player opens Future's targets window
 * (reason 'user-view', public API, no cookies) and kept a day: the game updates the file daily.
 */
import type { NetworkGuard } from '../core/guard';
import type { Store } from '../core/storage';

export interface UniversePlayers {
  at: number;
  /** id → [name, status letters as the API gives them: "", "i", "I", "v", "vi", "b", "a", "o" …]. */
  players: Record<string, [string, string]>;
}

export const UNIVERSE_PLAYERS_KEY = 'universe.players';
const TTL = 24 * 3_600_000;

export function parsePlayersXml(xml: string, now: number): UniversePlayers | null {
  const doc = new DOMParser().parseFromString(xml, 'text/html');
  const root = doc.querySelector('players');
  if (!root) return null;
  const players: UniversePlayers['players'] = {};
  for (const p of root.querySelectorAll('player')) {
    const id = p.getAttribute('id');
    if (id) players[id] = [p.getAttribute('name') ?? '', p.getAttribute('status') ?? ''];
  }
  return Object.keys(players).length ? { at: now, players } : null;
}

/** The API's status letters as Future's status names (same as the galaxy view's). */
export function statusNames(letters: string): string[] {
  const out: string[] = [];
  if (letters.includes('v')) out.push('vacation');
  if (letters.includes('b')) out.push('banned');
  if (letters.includes('I')) out.push('longinactive');
  else if (letters.includes('i')) out.push('inactive');
  if (letters.includes('o')) out.push('outlaw');
  if (letters.includes('a')) out.push('admin');
  return out;
}

export async function universePlayers(deps: { guard: NetworkGuard; store: Store; origin: string; now?: number }): Promise<UniversePlayers | null> {
  const now = deps.now ?? Date.now();
  const cached = deps.store.get<UniversePlayers | null>(UNIVERSE_PLAYERS_KEY, null);
  if (cached && now - cached.at < TTL) return cached;
  const res = await deps.guard.request(`${deps.origin}/api/players.xml`, 'user-view');
  const fresh = res.ok ? parsePlayersXml(await res.text(), now) : null;
  if (!fresh) return cached;
  deps.store.set(UNIVERSE_PLAYERS_KEY, fresh);
  return fresh;
}
