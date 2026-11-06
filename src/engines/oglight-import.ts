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
import { dayStart, type Journal, type JournalEntry } from './expeditions';
import type { Outcome } from '../data/messages';

interface OglPlayer { uid?: number; name?: string; pin?: string; status?: string }
interface OglPlanet { uid?: number; pid?: number; mid?: number; coo?: string; acti?: [unknown, unknown, number]; api?: number; debris?: number }
export interface OglightDb {
  dataFormat?: number;
  udb?: Record<string, OglPlayer>;
  pdb?: Record<string, OglPlanet>;
  tdb?: Record<string, { tag?: string }>;
  lastPinnedList?: number[];
  /** Per day ("2026-3-11"): expeditions, discoveries, raids, debris harvested, fuel. */
  stats?: Record<string, OglDay>;
}

interface OglBlock { count?: number; occurence?: Record<string, number>; gain?: Record<string, number> }
interface OglDay { expe?: OglBlock; discovery?: OglBlock; raid?: OglBlock; debris?: OglBlock; debris16?: OglBlock; conso?: number }

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

const OUTCOMES: Outcome[] = ['resource', 'darkmatter', 'ship', 'nothing', 'trader', 'item', 'blackhole', 'early', 'late', 'pirate', 'alien', 'artefact', 'lifeform'];

/** OGLight's gain map: resources by name, ships by id (a negative id = ships lost). */
function gains(g: Record<string, number> = {}) {
  const ships: Record<number, number> = {};
  const lost: Record<number, number> = {};
  let lfXp = 0;
  for (const [k, v] of Object.entries(g)) {
    if (/^-\d+$/.test(k)) lost[-Number(k)] = (lost[-Number(k)] ?? 0) + v;
    else if (/^\d+$/.test(k)) ships[Number(k)] = v;
    else if (/^lifeform\d$/.test(k)) lfXp += v;
  }
  return { res: { metal: g.metal ?? 0, crystal: g.crystal ?? 0, deuterium: g.deut ?? 0, darkMatter: g.dm ?? 0, food: 0 }, ships, lost, lfXp, artefacts: g.artefact ?? 0 };
}

const blank = (kind: JournalEntry['kind'], at: number): JournalEntry => ({
  kind, at, result: 'unknown', size: -1, depletion: 0, res: { metal: 0, crystal: 0, deuterium: 0, darkMatter: 0, food: 0 },
  ships: {}, lost: {}, item: null, lfXp: 0, lifeform: 0, artefacts: 0, coords: null,
});

/**
 * OGLight's daily statistics into the journal, one summary entry per day and kind. Expeditions and
 * discoveries of a day Future already logged itself are left out (they would count twice);
 * expedition debris (position 16) goes with that day's expeditions. Fuel is not carried over:
 * Future's own journal does not count it either.
 */
export function convertOglightStats(stats: Record<string, OglDay>, journal: Journal): { journal: Journal; days: number; expeditions: number; raids: number } {
  const own = new Set(Object.entries(journal).filter(([id, e]) => !id.startsWith('ogl-') && e.kind !== 'raid').map(([, e]) => dayStart(e.at)));
  const next: Journal = { ...journal };
  let days = 0;
  let expeditions = 0;
  let raids = 0;
  for (const [key, day] of Object.entries(stats)) {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(key);
    if (!m) continue;
    const at = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).getTime();
    const tag = `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`;
    let used = false;
    const put = (id: string, e: JournalEntry) => {
      if (next[id]) return;
      next[id] = e;
      used = true;
    };
    if (!own.has(dayStart(at))) {
      if (day.expe?.count || day.debris16?.count) {
        const g = gains(day.expe?.gain);
        const d16 = gains(day.debris16?.gain).res;
        const outcomes: Partial<Record<Outcome, number>> = {};
        for (const [k, v] of Object.entries(day.expe?.occurence ?? {})) outcomes[OUTCOMES.includes(k as Outcome) ? (k as Outcome) : 'unknown'] = v;
        put(`ogl-expe-${tag}`, { ...blank('expedition', at), ...g, res: { ...g.res, metal: g.res.metal + d16.metal, crystal: g.res.crystal + d16.crystal, deuterium: g.res.deuterium + d16.deuterium }, summary: { count: day.expe?.count ?? 0, outcomes } });
        expeditions += day.expe?.count ?? 0;
      }
      if (day.discovery?.count) {
        const g = gains(day.discovery.gain);
        const outcomes: Partial<Record<Outcome, number>> = {};
        for (const [k, v] of Object.entries(day.discovery.occurence ?? {})) outcomes[OUTCOMES.includes(k as Outcome) ? (k as Outcome) : 'unknown'] = v;
        put(`ogl-disc-${tag}`, { ...blank('discovery', at), lfXp: g.lfXp, artefacts: g.artefacts, summary: { count: day.discovery.count, outcomes } });
      }
    }
    // Raids, and debris fields harvested (a raid's second half): Future has no own log of them.
    if (day.raid?.count || day.debris?.count) {
      const g = gains(day.raid?.gain);
      const deb = gains(day.debris?.gain).res;
      put(`ogl-raid-${tag}`, { ...blank('raid', at), res: { ...g.res, metal: g.res.metal + deb.metal, crystal: g.res.crystal + deb.crystal, deuterium: g.res.deuterium + deb.deuterium }, lost: g.lost, summary: { count: day.raid?.count ?? 0, outcomes: {} } });
      raids += day.raid?.count ?? 0;
    }
    if (used) days++;
  }
  return { journal: next, days, expeditions, raids };
}
