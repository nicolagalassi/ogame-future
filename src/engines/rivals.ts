/**
 * Rivals: players the user marked in the galaxy view, compared category by category with the
 * player's own public scores. Pure functions: no DOM, no network.
 */
import type { PlayerScores, ScoreType } from '../data/player-api';
import { dayKey } from './history';

export interface Rival {
  id: number;
  name: string;
  at: number;
}

export const RIVALS_KEY = 'rivals.list';
export const RIVAL_POINTS_KEY = 'rivals.points';
export const RIVALS_MAX = 10;
const DAYS_KEPT = 90;

/** Adds or removes a rival (newest first); refuses to go past RIVALS_MAX. */
export function toggleRival(list: Rival[], rival: Rival): Rival[] {
  if (list.some((r) => r.id === rival.id)) return list.filter((r) => r.id !== rival.id);
  return list.length >= RIVALS_MAX ? list : [rival, ...list];
}

/** Total points seen per player and day (from the public API answers Future already got). */
export type RivalPoints = Record<string, { day: string; at: number; points: number }[]>;

export function recordPoints(book: RivalPoints, scores: PlayerScores): RivalPoints {
  const points = scores.scores.total?.points;
  if (points === undefined) return book;
  const day = dayKey(scores.at);
  const list = (book[String(scores.id)] ?? []).filter((d) => d.day !== day).concat({ day, at: scores.at, points });
  return { ...book, [String(scores.id)]: list.sort((a, b) => a.at - b.at).slice(-DAYS_KEPT) };
}

/** Points per day between the oldest and newest readings within `days`, null with one reading. */
export function pointsPerDay(book: RivalPoints, id: number, days: number): number | null {
  const list = book[String(id)] ?? [];
  const last = list.at(-1);
  if (!last) return null;
  const first = list.find((d) => last.at - d.at <= days * 86_400_000 + 3_600_000);
  if (!first || first === last) return null;
  return (last.points - first.points) / Math.max(1, (last.at - first.at) / 86_400_000);
}

export const COMPARED: ScoreType[] = ['total', 'economy', 'research', 'military', 'lifeform'];

/** Rival minus player, per category (null where either side is missing). */
export function gaps(me: PlayerScores | null, rival: PlayerScores): Partial<Record<ScoreType, number | null>> {
  const out: Partial<Record<ScoreType, number | null>> = {};
  for (const k of COMPARED) {
    const a = me?.scores[k]?.points, b = rival.scores[k]?.points;
    out[k] = a === undefined || b === undefined ? null : b - a;
  }
  return out;
}
