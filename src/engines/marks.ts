/**
 * Marks the player puts on other players (a flag) and on planets (a colour), as OGLight's pinned
 * players and tagged planets. Pure functions over Future's own stored data: no DOM, no network.
 */

/** Player flags, in the order the picker shows them. */
export const FLAGS = ['watch', 'target', 'farm', 'danger', 'friend', 'trade'] as const;
export type Flag = (typeof FLAGS)[number];

/** Planet colours, in the order the picker shows them. */
export const TAGS = ['red', 'orange', 'yellow', 'green', 'blue', 'violet'] as const;
export type Tag = (typeof TAGS)[number];

export interface PlayerMark {
  flag: Flag;
  name: string;
  at: number;
  /** The player's own words about this one (kept locally, like the flag). */
  note?: string;
}

export interface PlanetMark {
  tag: Tag;
  /** What the galaxy view showed when it was tagged (for the list without opening the galaxy). */
  planet: string;
  player: string;
  playerId: number | null;
  statuses: string[];
  moon: boolean;
  at: number;
}

export interface Marks {
  players: Record<string, PlayerMark>;
  /** Keyed by "g:s:p". */
  planets: Record<string, PlanetMark>;
  /** Players opened in the targets window, newest first. */
  recent: { id: number; name: string }[];
  lastFlag: Flag;
  lastTag: Tag;
}

export const MARKS_KEY = 'marks';
export const RECENT_MAX = 30;
export const EMPTY_MARKS: Marks = { players: {}, planets: {}, recent: [], lastFlag: 'watch', lastTag: 'red' };

export const loadMarks = (stored: Partial<Marks> | null): Marks => ({ ...EMPTY_MARKS, ...(stored ?? {}), players: { ...(stored?.players ?? {}) }, planets: { ...(stored?.planets ?? {}) }, recent: [...(stored?.recent ?? [])] });

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

/** Sets (or clears with null) a planet's colour. */
export function tagPlanet(m: Marks, coords: string, tag: Tag | null, info: Omit<PlanetMark, 'tag' | 'at'>, now: number): Marks {
  const planets = { ...m.planets };
  if (tag) planets[coords] = { ...info, tag, at: now };
  else delete planets[coords];
  return { ...m, planets, lastTag: tag ?? m.lastTag };
}

export function rememberRecent(m: Marks, id: number, name: string): Marks {
  return { ...m, recent: [{ id, name }, ...m.recent.filter((r) => r.id !== id)].slice(0, RECENT_MAX) };
}

const coordsValue = (c: string) => {
  const [g, s, p] = c.split(':').map(Number);
  return (g ?? 0) * 1_000_000 + (s ?? 0) * 1_000 + (p ?? 0);
};

/** Tagged planets between two "g:s" bounds (inclusive, either order), in coordinate order. */
export function planetsInRange(m: Marks, from: string, to: string, filter: { tags?: Tag[]; hide?: string[] } = {}): [string, PlanetMark][] {
  const lo = Math.min(coordsValue(`${from}:0`), coordsValue(`${to}:0`));
  const hi = Math.max(coordsValue(`${from}:999`), coordsValue(`${to}:999`));
  return Object.entries(m.planets)
    .filter(([c, p]) => {
      const v = coordsValue(c);
      return v >= lo && v <= hi && (!filter.tags || filter.tags.includes(p.tag)) && !p.statuses.some((s) => filter.hide?.includes(s));
    })
    .sort((a, b) => coordsValue(a[0]) - coordsValue(b[0]));
}

/**
 * One-time move of the data Future kept before 2026-11-06: galaxy targets become red planets,
 * rivals become players to watch. Returns null when there is nothing to move.
 */
export function migrateOld(m: Marks, old: { targets: { coords: string; planet: string; player: string; at: number }[]; rivals: { id: number; name: string; at: number }[] }): Marks | null {
  if (!old.targets.length && !old.rivals.length) return null;
  let next = m;
  for (const x of old.targets) if (!next.planets[x.coords]) next = tagPlanet(next, x.coords, 'red', { planet: x.planet, player: x.player, playerId: null, statuses: [], moon: false }, x.at);
  for (const r of old.rivals) if (!next.players[String(r.id)]) next = flagPlayer(next, r.id, r.name, 'watch', r.at);
  return { ...next, lastFlag: m.lastFlag, lastTag: m.lastTag };
}
