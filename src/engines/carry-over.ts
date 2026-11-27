/**
 * Settings and statistics carried from one universe into another (server merges move a player to a new
 * universe, where Future starts empty). The source is a backup's data or this install's own storage:
 * every universe and player sits under `future:<universe>:<player>:`.
 *
 * Only what does not depend on where things are crosses over: views and settings, the expedition and raid
 * journal, the account history and Orion's statistics. Coordinates, planet and moon ids, players, plans
 * and anything keyed by the old server's ids stay behind. An allowlist: a key not named here never moves.
 *
 * COMPLIANCE (AGENTS.md §1.9): local data only, no network.
 */
import { JOURNAL_KEY, trim, type Journal } from './expeditions';
import { SETTINGS_KEY, settingsFrom, type FleetSettings } from './fleet';
import { HISTORY_KEY, HISTORY_MAX, type History } from './history';
import { ARCHIVE_KEY, MULT_KEY, loadArchive, type Archive, type Mults } from './orion';

const KEY = /^(future:[^:]+:\d+):(.+)$/;

/** Views and choices with nothing of the old universe in them: copied as they are, over this universe's. */
export const CARRY_COPY = [
  'planetMenu.totals', 'planetMenu.fleet', 'planetMenu.totalView', 'planetMenu.gameTips',
  'keys.map', 'keys.touch', 'msg.expStyle', 'msg.fold', 'spy.view', 'spy.shared', 'galaxy.bigDebris',
  'exp.kind', 'exp.period', 'settings.tab', 'sim.tool', 'remind.desktop', 'dash.rates', 'dash.investExclude',
];
/** The targets bar's view: kept, without the old universe's player whose sheet was open. */
export const MARKS_VIEW = 'marks.view';

export interface CarrySource {
  /** `future:<universe>:<player>`. */
  ns: string;
  /** The universe's host without the game's domain, e.g. "s123-it". */
  universe: string;
  player: string;
  /** Expeditions and raids in its journal, days in its history. */
  journal: number;
  days: number;
}

export interface CarryResult {
  /** Keys of this universe (without the namespace) and the values to write. */
  writes: Record<string, unknown>;
  settings: number;
  /** New journal entries, history days and Orion anomalies (already carried ones are not counted again). */
  journal: number;
  days: number;
  orion: number;
}

const split = (key: string): [string, string] | null => {
  const m = KEY.exec(key);
  return m ? [m[1]!, m[2]!] : null;
};
const universeOf = (ns: string) => ns.split(':')[1]!.replace(/\.ogame\.gameforge\.com$/, '');

/** The universes and players in `data` other than this one, with what they would bring. */
export function carrySources(data: Record<string, unknown>, current: string): CarrySource[] {
  const found = new Map<string, CarrySource>();
  for (const [key, value] of Object.entries(data)) {
    const parts = split(key);
    if (!parts || parts[0] === current) continue;
    const [ns, sub] = parts;
    const s = found.get(ns) ?? { ns, universe: universeOf(ns), player: ns.split(':')[2]!, journal: 0, days: 0 };
    if (sub === JOURNAL_KEY && value && typeof value === 'object') s.journal = Object.keys(value).length;
    if (sub === HISTORY_KEY && Array.isArray(value)) s.days = value.length;
    found.set(ns, s);
  }
  // Only what has something to bring.
  const brings = (s: CarrySource) => s.journal || s.days || [...CARRY_COPY, MARKS_VIEW, SETTINGS_KEY, ARCHIVE_KEY].some((k) => `${s.ns}:${k}` in data);
  return [...found.values()].filter(brings);
}

/**
 * What `from` brings into this universe, given what this universe already holds (`here`, by key).
 * Settings overwrite; statistics merge, this universe's own entries first. Ids the new server may give
 * again (message ids, anomaly ids) are tagged with the old universe, so carrying twice changes nothing
 * and a new report with an old id is still recorded.
 */
export function carryOver(data: Record<string, unknown>, from: string, here: (key: string) => unknown, now: number): CarryResult {
  const src = (key: string) => data[`${from}:${key}`];
  const tag = `@${universeOf(from)}`;
  const tagged = (id: string) => (!id || id.endsWith(tag) ? id : `${id}${tag}`);
  const writes: Record<string, unknown> = {};
  let settings = 0;

  for (const key of CARRY_COPY) {
    if (src(key) === undefined) continue;
    writes[key] = src(key);
    settings++;
  }
  const view = src(MARKS_VIEW);
  if (view && typeof view === 'object') {
    writes[MARKS_VIEW] = { ...view, player: null };
    settings++;
  }
  const fleet = src(SETTINGS_KEY) as Partial<FleetSettings> | undefined;
  if (fleet && typeof fleet === 'object') {
    // Favourite destinations, the typed target, the mode left on and the bodies the round skips are the
    // old universe's; only the settings' own fields cross (an old stored shape is read as today's).
    writes[SETTINGS_KEY] = { ...settingsFrom(fleet), favTransport: null, favDeploy: null, sendTarget: null, sendMode: null, skipBodies: [] };
    settings++;
  }

  let journal = 0;
  const oldJournal = src(JOURNAL_KEY) as Journal | undefined;
  if (oldJournal && typeof oldJournal === 'object') {
    const mine = (here(JOURNAL_KEY) as Journal | undefined) ?? {};
    const next: Journal = { ...mine };
    for (const [id, e] of Object.entries(oldJournal)) {
      const key = tagged(id);
      if (!(key in mine)) next[key] = { ...e, coords: null };
    }
    // Counted after the journal's own limits: a report too old to keep is not brought.
    const kept = trim(next, now);
    journal = Object.keys(kept).filter((k) => !(k in mine)).length;
    if (journal) writes[JOURNAL_KEY] = kept;
  }

  let days = 0;
  const oldHistory = src(HISTORY_KEY) as History | undefined;
  if (Array.isArray(oldHistory)) {
    const mine = (here(HISTORY_KEY) as History | undefined) ?? [];
    const have = new Set(mine.map((d) => d.day));
    const added = oldHistory.filter((d) => d?.day && !have.has(d.day));
    days = added.length;
    if (days) writes[HISTORY_KEY] = [...mine, ...added].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0)).slice(-HISTORY_MAX);
  }

  const mults = src(MULT_KEY) as Mults | undefined;
  if (mults && typeof mults === 'object') writes[MULT_KEY] = { ...mults, ...((here(MULT_KEY) as Mults | undefined) ?? {}) };

  let orion = 0;
  const oldArchive = src(ARCHIVE_KEY) as Partial<Archive> | undefined;
  if (oldArchive && typeof oldArchive === 'object') {
    const a = loadArchive(oldArchive);
    const mine = loadArchive(here(ARCHIVE_KEY) as Partial<Archive> | undefined);
    const entries = { ...mine.entries };
    for (const e of Object.values(a.entries)) {
      const id = tagged(e.id);
      if (entries[id]) continue;
      // Ended where it was: the new universe never lists it again.
      const ended = e.status === 'running' ? { status: e.collections.length ? ('collected' as const) : ('expired' as const), endedAt: e.lastSeen || now } : {};
      entries[id] = { ...e, ...ended, id, coords: '', located: false };
      orion++;
    }
    const battles = { ...mine.battles };
    for (const [id, b] of Object.entries(a.battles)) battles[tagged(id)] ??= { ...b, entry: tagged(b.entry), coords: '' };
    const fuelSeen = new Set(mine.fuel.filter((f) => !f.coords).map((f) => `${f.at}|${f.deut}`));
    const fuel = [...mine.fuel, ...a.fuel.filter((f) => !fuelSeen.has(`${f.at}|${f.deut}`)).map((f) => ({ ...f, coords: '' }))];
    if (orion || fuel.length > mine.fuel.length || Object.keys(battles).length > Object.keys(mine.battles).length) writes[ARCHIVE_KEY] = { ...mine, entries, battles, fuel };
  }

  return { writes, settings, journal, days, orion };
}
