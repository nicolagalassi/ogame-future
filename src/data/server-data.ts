/**
 * Universe settings from the public API (`/api/serverData.xml`): size, donut, fleet speeds.
 *
 * COMPLIANCE (AGENTS.md §4, §6): read on page load only, and only when the cached copy is older
 * than a week (the file changes when Gameforge changes the universe). Public API, no cookies.
 */
import type { NetworkGuard } from '../core/guard';
import type { Store } from '../core/storage';

export interface ServerData {
  at: number;
  galaxies: number;
  systems: number;
  donutGalaxy: boolean;
  donutSystem: boolean;
  speedFleetWar: number;
  speedFleetPeaceful: number;
}

export const SERVER_DATA_KEY = 'server.data';
const TTL = 7 * 24 * 3_600_000;

export function parseServerData(xml: string, now: number): ServerData | null {
  const doc = new DOMParser().parseFromString(xml, 'text/html');
  const root = doc.querySelector('serverdata');
  const num = (tag: string) => Number(root?.querySelector(tag)?.textContent?.trim());
  const galaxies = num('galaxies'), systems = num('systems');
  if (!root || !galaxies || !systems) return null;
  return {
    at: now,
    galaxies,
    systems,
    donutGalaxy: num('donutGalaxy') === 1,
    donutSystem: num('donutSystem') === 1,
    speedFleetWar: num('speedFleetWar') || 1,
    speedFleetPeaceful: num('speedFleetPeaceful') || 1,
  };
}

/** The cached settings, re-read from the API on page load when older than a week. */
export async function loadServerDataOnPageLoad(deps: { guard: NetworkGuard; store: Store; origin: string; now?: number }): Promise<ServerData | null> {
  const now = deps.now ?? Date.now();
  const cached = deps.store.get<ServerData | null>(SERVER_DATA_KEY, null);
  if (cached && now - cached.at < TTL) return cached;
  const res = await deps.guard.request(`${deps.origin}/api/serverData.xml`, 'page-load');
  const fresh = res.ok ? parseServerData(await res.text(), now) : null;
  if (!fresh) return cached;
  deps.store.set(SERVER_DATA_KEY, fresh);
  return fresh;
}
