/**
 * Points made since midnight, from the universe's public highscore (`/api/highscore.xml`).
 *
 * The file is updated about once an hour. Future keeps, per category, the first reading of each
 * day as its base (or the previous day's last reading when it was taken from 23:00 on, which is
 * closer to midnight); points made today = score now − score at the base.
 *
 * COMPLIANCE (AGENTS.md §4, §6): read only while the player has the highscore page open (reason
 * 'user-view', public API, no cookies) and at most once an hour per category.
 */
import type { NetworkGuard } from '../core/guard';
import type { Store } from '../core/storage';
import { dayKey } from '../engines/history';

export interface HighscoreReading {
  /** The file's own timestamp (ms). */
  at: number;
  /** When Future read it (ms), for the hourly limit. */
  readAt: number;
  scores: Record<string, number>;
}

export interface DailyBase {
  day: string;
  base: HighscoreReading;
  last: HighscoreReading;
}

/** Highscore page category button → public API type. */
export const API_TYPES: Record<string, number> = { points: 0, economy: 1, research: 2, fleet: 3, lifeform: 8 };

const key = (type: number) => `hs.daily.${type}`;
const TTL = 3_600_000;

export function parseHighscoreXml(xml: string, readAt: number): HighscoreReading | null {
  const doc = new DOMParser().parseFromString(xml, 'text/html');
  const root = doc.querySelector('highscore');
  const ts = Number(root?.getAttribute('timestamp'));
  if (!root || !ts) return null;
  const scores: Record<string, number> = {};
  for (const p of root.querySelectorAll('player')) {
    const id = p.getAttribute('id');
    const score = Number(p.getAttribute('score'));
    if (id && Number.isFinite(score)) scores[id] = Math.floor(score);
  }
  return { at: ts * 1000, readAt, scores };
}

/** Takes a new reading into the day's base. */
export function updateBase(prev: DailyBase | null, reading: HighscoreReading): DailyBase {
  const day = dayKey(reading.at);
  if (prev && prev.day === day) return { ...prev, last: reading };
  // A new day: yesterday's last reading if it was taken from 23:00 on, else this one.
  const lastHour = prev ? new Date(prev.last.at).getHours() : -1;
  const base = prev && lastHour >= 23 && reading.at - prev.last.at < 2 * TTL ? prev.last : reading;
  return { day, base, last: reading };
}

/** The stored base for a category, reading the API first when the last reading is over an hour old. */
export async function dailyBase(deps: { guard: NetworkGuard; store: Store; origin: string; type: number; now?: number }): Promise<DailyBase | null> {
  const now = deps.now ?? Date.now();
  const stored = deps.store.get<DailyBase | null>(key(deps.type), null);
  if (stored && now - stored.last.readAt < TTL && stored.day === dayKey(now)) return stored;
  const res = await deps.guard.request(`${deps.origin}/api/highscore.xml?category=1&type=${deps.type}`, 'user-view');
  const reading = res.ok ? parseHighscoreXml(await res.text(), now) : null;
  if (!reading) return stored;
  const next = updateBase(stored, reading);
  deps.store.set(key(deps.type), next);
  return next;
}
