/**
 * Marks the player puts on other players (a flag and a note), as OGLight's pinned players.
 * (Coloured planets existed until 2026-11-11; Nicola had them removed: stored ones are ignored.)
 * Pure functions over Future's own stored data: no DOM, no network.
 */

/** Player flags, in the order the picker shows them. */
export const FLAGS = ['watch', 'target', 'farm', 'danger', 'friend', 'trade'] as const;
export type Flag = (typeof FLAGS)[number];

export interface PlayerMark {
  flag: Flag;
  name: string;
  at: number;
  /** The player's own words about this one (kept locally, like the flag). */
  note?: string;
}

export interface Marks {
  players: Record<string, PlayerMark>;
  /** Players opened in the targets window, newest first. */
  recent: { id: number; name: string }[];
  lastFlag: Flag;
}

export const MARKS_KEY = 'marks';
export const RECENT_MAX = 30;
export const EMPTY_MARKS: Marks = { players: {}, recent: [], lastFlag: 'watch' };

/** Stored marks, players and recent ones only (old coloured planets in the store are left out). */
export const loadMarks = (stored: Partial<Marks> | null): Marks => ({
  players: { ...(stored?.players ?? {}) },
  recent: [...(stored?.recent ?? [])],
  lastFlag: stored?.lastFlag ?? EMPTY_MARKS.lastFlag,
});

/** Sets (or clears with null) a player's flag; a set flag becomes the one shift+click repeats. */
export function flagPlayer(m: Marks, id: number, name: string, flag: Flag | null, now: number): Marks {
  const players = { ...m.players };
  if (flag) players[String(id)] = { ...players[String(id)], flag, name: name || players[String(id)]?.name || '', at: now };
  else delete players[String(id)];
  return { ...m, players, lastFlag: flag ?? m.lastFlag };
}

/** Writes (or clears) the note of a flagged player; a player without a flag has no note. */
export function notePlayer(m: Marks, id: number, note: string): Marks {
  const mark = m.players[String(id)];
  if (!mark) return m;
  const next = { ...mark };
  const text = note.trim().slice(0, 500);
  if (text) next.note = text;
  else delete next.note;
  return { ...m, players: { ...m.players, [String(id)]: next } };
}

export function rememberRecent(m: Marks, id: number, name: string): Marks {
  return { ...m, recent: [{ id, name }, ...m.recent.filter((r) => r.id !== id)].slice(0, RECENT_MAX) };
}

/**
 * One-time move of the data Future kept before 2026-11-06: rivals become players to watch (the old
 * galaxy targets went with the coloured planets). Returns null when there is nothing to move.
 */
export function migrateOld(m: Marks, old: { targets: { coords: string; planet: string; player: string; at: number }[]; rivals: { id: number; name: string; at: number }[] }): Marks | null {
  if (!old.rivals.length) return null;
  let next = m;
  for (const r of old.rivals) if (!next.players[String(r.id)]) next = flagPlayer(next, r.id, r.name, 'watch', r.at);
  return { ...next, lastFlag: m.lastFlag };
}
