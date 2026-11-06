/**
 * Moving over from OGLight: its "Export data" file (one universe) becomes Future's marks and
 * position memory. Pinned players get the nearest flag, tagged planets the nearest colour, the
 * players opened lately stay the recent ones, the galaxy readings become positions.
 * What Future already has is kept: only what is missing is added.
 * Pure functions over the file's JSON: no DOM, no network (the file never leaves the browser).
 */
import type { Activity } from '../data/galaxy';
import { flagPlayer, RECENT_MAX, tagPlanet, type Flag, type Marks, type Tag } from './marks';
import type { Positions } from './positions';

interface OglPlayer { uid?: number; name?: string; pin?: string; status?: string }
interface OglPlanet { uid?: number; pid?: number; mid?: number; coo?: string; acti?: [unknown, unknown, number]; api?: number; debris?: number }
export interface OglightDb {
  dataFormat?: number;
  udb?: Record<string, OglPlayer>;
  pdb?: Record<string, OglPlanet>;
  tdb?: Record<string, { tag?: string }>;
  lastPinnedList?: number[];
}

/** OGLight pin → Future flag. */
const PINS: Record<string, Flag> = { friend: 'friend', rush: 'target', danger: 'danger', skull: 'target', fridge: 'farm', star: 'watch', trade: 'trade', money: 'trade', ptre: 'watch' };
/** OGLight tag colour → Future colour (gray and none are not carried over). */
const TAGS: Record<string, Tag> = { red: 'red', pink: 'red', orange: 'orange', brown: 'orange', yellow: 'yellow', lime: 'green', green: 'green', blue: 'blue', dblue: 'blue', violet: 'violet', magenta: 'violet' };

export function isOglightDb(x: unknown): x is OglightDb {
  return !!x && typeof x === 'object' && typeof (x as OglightDb).dataFormat === 'number' && typeof (x as OglightDb).udb === 'object' && typeof (x as OglightDb).pdb === 'object';
}

const STATUS: Record<string, string> = { v: 'vacation', b: 'banned', I: 'longinactive', i: 'inactive', o: 'outlaw', a: 'admin' };
const coordsOk = (c: string) => /^\d+:\d+:\d+$/.test(c);
const act = (v: unknown): Activity => (v === '*' ? '*' : Number(v) > 0 && Number(v) < 60 ? Number(v) : null);

export function convertOglight(db: OglightDb, marks: Marks, positions: Positions, now: number): { marks: Marks; positions: Positions; players: number; planets: number; seen: number } {
  let m = marks;
  let players = 0;
  let planets = 0;
  const udb = db.udb ?? {};
  const pdb = db.pdb ?? {};
  for (const [id, p] of Object.entries(udb)) {
    const flag = p.pin ? PINS[p.pin] : undefined;
    if (!flag || m.players[id]) continue;
    m = flagPlayer(m, Number(id), p.name ?? '', flag, now);
    players++;
  }
  for (const [coords, x] of Object.entries(db.tdb ?? {})) {
    const tag = x.tag ? TAGS[x.tag] : undefined;
    if (!tag || !coordsOk(coords) || m.planets[coords]) continue;
    const owner = pdb[coords]?.uid;
    const who = owner ? udb[String(owner)] : undefined;
    m = tagPlanet(m, coords, tag, { planet: '', player: who?.name ?? '', playerId: owner && owner > 0 ? owner : null, statuses: who?.status && STATUS[who.status] ? [STATUS[who.status]!] : [], moon: (pdb[coords]?.mid ?? -1) > 0 }, now);
    planets++;
  }
  const recent = [...m.recent];
  for (const id of db.lastPinnedList ?? []) if (!recent.some((r) => r.id === Number(id))) recent.push({ id: Number(id), name: udb[String(id)]?.name ?? '' });
  m = { ...m, recent: recent.slice(0, RECENT_MAX), lastFlag: marks.lastFlag, lastTag: marks.lastTag };

  // Galaxy readings, for the players and planets now marked (as Future keeps them itself).
  const next: Positions = { ...positions };
  let seen = 0;
  for (const [coords, x] of Object.entries(pdb)) {
    const uid = Number(x.uid);
    if (!coordsOk(coords) || !(uid > 0) || next[coords] || !(m.players[String(uid)] || m.planets[coords] || m.recent.some((r) => r.id === uid))) continue;
    next[coords] = { player: uid, name: '', moon: (x.mid ?? -1) > 0, debris: Math.round(Number(x.debris) || 0), act: [act(x.acti?.[0]), act(x.acti?.[1])], at: Number(x.acti?.[2]) || Number(x.api) || 0 };
    seen++;
  }
  return { marks: m, positions: next, players, planets, seen };
}
