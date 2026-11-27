/**
 * Expedition journal: every expedition (and discovery) report the player has opened in the
 * inbox, kept locally, with totals per period. Pure functions: no DOM, no network.
 * Data stays on the player's machine (AGENTS.md §1.9).
 */
import type { ExpeditionMessage, Outcome } from '../data/messages';
import { rawCost } from './tech';

export const JOURNAL_KEY = 'exp.journal';
const DAY = 86_400_000;
/** Older entries leave the journal: about a year and a half of play. */
const KEEP_MS = 550 * DAY;
const MAX_ENTRIES = 25_000;

export type JournalEntry = Omit<ExpeditionMessage, 'id' | 'kind'> & {
  /** 'raid': the player's own attacks (combat reports, attacker side) and the debris they harvested, also
   *  from an OGLight import. */
  kind: ExpeditionMessage['kind'] | 'raid';
  /** Losses from the combat report at position 16 (pirates/aliens), not a separate expedition. */
  combat?: boolean;
  /** Debris harvested at position 16 by the expedition's pathfinders (recycling report): resources, not an expedition. As OGLight. */
  debris?: boolean;
  /** A whole day from OGLight's statistics: how many reports it stands for, and their outcomes. */
  summary?: { count: number; outcomes: Partial<Record<Outcome, number>> };
};
export type Journal = Record<string, JournalEntry>;

export type Res4 = { metal: number; crystal: number; deuterium: number; darkMatter: number };
const ZERO = (): Res4 => ({ metal: 0, crystal: 0, deuterium: 0, darkMatter: 0 });

/** Adds new reports; a report already in the journal is not counted twice. */
export function record(journal: Journal, messages: ExpeditionMessage[]): { journal: Journal; added: number } {
  let added = 0;
  let next = journal;
  const seen = new Set(Object.values(journal).map(signature).filter(Boolean));
  for (const { id, ...entry } of messages) {
    if (next[id]) continue;
    // The same report under another id (e.g. a copy in another inbox tab) is the same expedition.
    const sig = signature(entry);
    if (sig && seen.has(sig)) continue;
    if (sig) seen.add(sig);
    if (next === journal) next = { ...journal };
    next[id] = entry;
    added++;
  }
  return { journal: next, added };
}

/**
 * What makes a report one expedition: arrival second, spot, outcome and everything it brought.
 * Two different expeditions match on all of it practically never. Summaries, combat and debris: none.
 */
export function signature(e: JournalEntry): string {
  if (e.summary || e.combat || e.debris || e.kind !== 'expedition') return '';
  const units = (u: Record<number, number>) => Object.entries(u).sort(([a], [b]) => Number(a) - Number(b)).map(([k, v]) => `${k}:${v}`).join(',');
  return [e.at, e.coords ?? '', e.result, e.size, e.res.metal, e.res.crystal, e.res.deuterium, e.res.darkMatter, units(e.ships), units(e.lost), e.item ?? ''].join('|');
}

/** Drops reports recorded twice under different ids (the oldest id stays). */
export function dedupe(journal: Journal): { journal: Journal; removed: number } {
  const seen = new Set<string>();
  let removed = 0;
  const next: Journal = {};
  for (const [id, e] of Object.entries(journal).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))) {
    const sig = signature(e);
    if (sig && seen.has(sig)) {
      removed++;
      continue;
    }
    if (sig) seen.add(sig);
    next[id] = e;
  }
  return { journal: removed ? next : journal, removed };
}

/** Debris the expedition's pathfinders harvested at position 16: their resources count with the expeditions. */
export function recordDebris(journal: Journal, id: string, at: number, res: { metal: number; crystal: number; deuterium: number }, coords: string | null): { journal: Journal; added: number } {
  if (journal[id] || res.metal + res.crystal + res.deuterium <= 0) return { journal, added: 0 };
  const entry: JournalEntry = {
    kind: 'expedition',
    at,
    result: 'unknown',
    size: -1,
    depletion: 0,
    res: { metal: res.metal, crystal: res.crystal, deuterium: res.deuterium, darkMatter: 0, food: 0 },
    ships: {},
    lost: {},
    item: null,
    lfXp: 0,
    lifeform: 0,
    artefacts: 0,
    coords,
    debris: true,
  };
  return { journal: { ...journal, [id]: entry }, added: 1 };
}

/** Losses of a combat at an expedition position: they count against the expeditions. */
export function recordCombat(journal: Journal, id: string, at: number, lost: Record<number, number>, coords: string | null): { journal: Journal; added: number } {
  if (journal[id] || !Object.keys(lost).length) return { journal, added: 0 };
  const entry: JournalEntry = {
    kind: 'expedition',
    at,
    result: 'unknown',
    size: -1,
    depletion: 0,
    res: { metal: 0, crystal: 0, deuterium: 0, darkMatter: 0, food: 0 },
    ships: {},
    lost,
    item: null,
    lfXp: 0,
    lifeform: 0,
    artefacts: 0,
    coords,
    combat: true,
  };
  return { journal: { ...journal, [id]: entry }, added: 1 };
}

/** Espionage probe: a combat that only cost probes and brought nothing is a spy mission, not a raid. */
const PROBE = 210;

/**
 * The player's own attack (combat report, attacker side): the loot brought home and the ships lost. Not at
 * an expedition position (pirates and aliens count with the expeditions) nor a probe shot down while spying.
 */
export function recordRaid(journal: Journal, id: string, at: number, loot: { metal: number; crystal: number; deuterium: number }, lost: Record<number, number>, coords: string | null): { journal: Journal; added: number } {
  const res = { metal: Math.max(0, loot.metal), crystal: Math.max(0, loot.crystal), deuterium: Math.max(0, loot.deuterium) };
  const onlyProbes = Object.keys(lost).every((u) => Number(u) === PROBE) && res.metal + res.crystal + res.deuterium === 0;
  if (journal[id] || onlyProbes) return { journal, added: 0 };
  return { journal: { ...journal, [id]: raidEntry(at, res, lost, coords) }, added: 1 };
}

/** Debris the player's recyclers harvested away from expeditions: it counts with the raids, not as one more raid. */
export function recordHarvest(journal: Journal, id: string, at: number, res: { metal: number; crystal: number; deuterium: number }, coords: string | null): { journal: Journal; added: number } {
  if (journal[id] || res.metal + res.crystal + res.deuterium <= 0) return { journal, added: 0 };
  return { journal: { ...journal, [id]: { ...raidEntry(at, res, {}, coords), debris: true } }, added: 1 };
}

const raidEntry = (at: number, res: { metal: number; crystal: number; deuterium: number }, lost: Record<number, number>, coords: string | null): JournalEntry => ({
  kind: 'raid',
  at,
  result: 'unknown',
  size: -1,
  depletion: 0,
  res: { metal: res.metal, crystal: res.crystal, deuterium: res.deuterium, darkMatter: 0, food: 0 },
  ships: {},
  lost,
  item: null,
  lfXp: 0,
  lifeform: 0,
  artefacts: 0,
  coords,
});

export function trim(journal: Journal, now: number): Journal {
  const entries = Object.entries(journal).filter(([, e]) => e.at > now - KEEP_MS);
  if (entries.length > MAX_ENTRIES) entries.sort((a, b) => b[1].at - a[1].at).splice(MAX_ENTRIES);
  return entries.length === Object.keys(journal).length ? journal : Object.fromEntries(entries);
}

/** Resource value of units (ships found or lost), at base cost. */
export function unitsValue(units: Record<number, number>): Res4 {
  const out = ZERO();
  for (const [id, n] of Object.entries(units)) {
    const c = rawCost(Number(id), 1);
    out.metal += c.metal * n;
    out.crystal += c.crystal * n;
    out.deuterium += c.deuterium * n;
  }
  return out;
}

/** Metal-standard units: 1 crystal = 1.5 metal, 1 deuterium = 3 metal (as in the cost panel). */
export const msu = (r: { metal: number; crystal: number; deuterium: number }): number => r.metal + r.crystal * 1.5 + r.deuterium * 3;

export interface PeriodStats {
  /** Expeditions (without discoveries and combat entries). */
  count: number;
  discoveries: number;
  outcomes: Partial<Record<Outcome, number>>;
  res: Res4;
  shipsFound: Record<number, number>;
  shipsValue: Res4;
  lost: Record<number, number>;
  lostValue: Res4;
  lfXp: number;
  artefacts: number;
  items: string[];
  sizes: [number, number, number];
  /** Of the resources: debris harvested at position 16, in MSU. */
  debris: number;
  /** Resources + ships found − ships lost, in MSU. */
  netMsu: number;
}

export function periodStats(entries: JournalEntry[]): PeriodStats {
  const s: PeriodStats = {
    count: 0,
    discoveries: 0,
    outcomes: {},
    res: ZERO(),
    shipsFound: {},
    shipsValue: ZERO(),
    lost: {},
    lostValue: ZERO(),
    lfXp: 0,
    artefacts: 0,
    items: [],
    sizes: [0, 0, 0],
    debris: 0,
    netMsu: 0,
  };
  for (const e of entries) {
    if (e.kind === 'raid') continue;
    const n = e.summary ? e.summary.count : 1;
    if (e.kind === 'discovery') s.discoveries += n;
    else if (!e.combat && !e.debris) s.count += n;
    if (e.summary) for (const [k, v] of Object.entries(e.summary.outcomes)) s.outcomes[k as Outcome] = (s.outcomes[k as Outcome] ?? 0) + (v ?? 0);
    else if (!e.combat && !e.debris) s.outcomes[e.result] = (s.outcomes[e.result] ?? 0) + 1;
    // Ship finds saved by older versions may hold the ships' value as resources too: ships only.
    const res = !e.summary && e.result === 'ship' ? { metal: 0, crystal: 0, deuterium: 0 } : e.res;
    s.res.metal += res.metal;
    s.res.crystal += res.crystal;
    s.res.deuterium += res.deuterium;
    s.res.darkMatter += e.res.darkMatter;
    if (e.debris) s.debris += msu(e.res);
    for (const [id, n] of Object.entries(e.ships)) s.shipsFound[Number(id)] = (s.shipsFound[Number(id)] ?? 0) + n;
    for (const [id, n] of Object.entries(e.lost)) s.lost[Number(id)] = (s.lost[Number(id)] ?? 0) + n;
    s.lfXp += e.lfXp;
    s.artefacts += e.artefacts;
    if (e.item) s.items.push(e.item);
    if (e.size >= 0 && e.size <= 2) s.sizes[e.size]!++;
  }
  s.shipsValue = unitsValue(s.shipsFound);
  s.lostValue = unitsValue(s.lost);
  s.netMsu = msu(s.res) + msu(s.shipsValue) - msu(s.lostValue);
  return s;
}

/** Local midnight of the day `at` falls in. */
export function dayStart(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export type Period = 'today' | 'yesterday' | 'week' | 'month' | 'all';

export function periodRange(period: Period, now: number): [number, number] {
  const today = dayStart(now);
  switch (period) {
    case 'today':
      return [today, Infinity];
    case 'yesterday':
      return [dayStart(today - 1), today];
    case 'week':
      return [dayStart(today - 6 * DAY), Infinity];
    case 'month':
      return [dayStart(today - 29 * DAY), Infinity];
    default:
      return [0, Infinity];
  }
}

export function entriesIn(journal: Journal, [from, to]: [number, number]): JournalEntry[] {
  return Object.values(journal)
    .filter((e) => e.at >= from && e.at < to)
    .sort((a, b) => b.at - a.at);
}

/** One row per day, most recent first, only days with at least one entry. */
export function byDay(entries: JournalEntry[], limit = 14): { day: number; stats: PeriodStats }[] {
  const days = new Map<number, JournalEntry[]>();
  for (const e of entries) {
    if (e.kind === 'raid') continue;
    const key = dayStart(e.at);
    const list = days.get(key) ?? [];
    list.push(e);
    days.set(key, list);
  }
  return [...days.entries()]
    .sort((a, b) => b[0] - a[0])
    .slice(0, limit)
    .map(([day, list]) => ({ day, stats: periodStats(list) }));
}

/** One column of the journal chart: when it starts and what happened in it. */
export interface Bucket {
  start: number;
  stats: PeriodStats;
}

/** The 24 hours of the day starting at `day` (local time), raids left out. */
export function hourSeries(entries: JournalEntry[], day: number): Bucket[] {
  const lists: JournalEntry[][] = Array.from({ length: 24 }, () => []);
  for (const e of entries) {
    if (e.kind === 'raid' || dayStart(e.at) !== day) continue;
    lists[new Date(e.at).getHours()]!.push(e);
  }
  return lists.map((list, h) => ({ start: new Date(day).setHours(h, 0, 0, 0), stats: periodStats(list) }));
}

/** `n` days ending with the day of `last` (local days, oldest first), empty days included, raids left out. */
export function daySeries(entries: JournalEntry[], last: number, n: number): Bucket[] {
  const starts: number[] = [];
  let d = dayStart(last);
  for (let i = 0; i < n; i++) {
    starts.unshift(d);
    d = dayStart(d - 1);
  }
  const lists = new Map(starts.map((s) => [s, [] as JournalEntry[]]));
  for (const e of entries) if (e.kind !== 'raid') lists.get(dayStart(e.at))?.push(e);
  return starts.map((start) => ({ start, stats: periodStats(lists.get(start)!) }));
}

/** Raids of each hour of the day starting at `day`, or of each of the `n` days ending with `last`'s (oldest first). */
export interface RaidBucket {
  start: number;
  stats: RaidStats;
}
export function raidHours(entries: JournalEntry[], day: number): RaidBucket[] {
  const lists: JournalEntry[][] = Array.from({ length: 24 }, () => []);
  for (const e of entries) if (e.kind === 'raid' && dayStart(e.at) === day) lists[new Date(e.at).getHours()]!.push(e);
  return lists.map((list, h) => ({ start: new Date(day).setHours(h, 0, 0, 0), stats: raidStats(list) }));
}
export function raidDays(entries: JournalEntry[], last: number, n: number): RaidBucket[] {
  const starts: number[] = [];
  for (let i = 0, d = dayStart(last); i < n; i++, d = dayStart(d - 1)) starts.unshift(d);
  const lists = new Map(starts.map((s) => [s, [] as JournalEntry[]]));
  for (const e of entries) if (e.kind === 'raid') lists.get(dayStart(e.at))?.push(e);
  return starts.map((start) => ({ start, stats: raidStats(lists.get(start)!) }));
}

/** Where the raids paid: each attacked position with its raids and loot (MSU), best first. Harvests left out. */
export function raidTargets(entries: JournalEntry[]): { coords: string; count: number; msu: number }[] {
  const by = new Map<string, { coords: string; count: number; msu: number }>();
  for (const e of entries) {
    if (e.kind !== 'raid' || e.debris || e.summary || !e.coords) continue;
    const t = by.get(e.coords) ?? { coords: e.coords, count: 0, msu: 0 };
    t.count++;
    t.msu += msu(e.res);
    by.set(e.coords, t);
  }
  return [...by.values()].sort((a, b) => b.msu - a.msu || b.count - a.count);
}

/** A period's net gain per resource: resources found, plus the cost of the ships found, minus that of the ships lost. In MSU it is `netMsu`. */
export function netRes(s: PeriodStats): { metal: number; crystal: number; deuterium: number } {
  const of = (k: 'metal' | 'crystal' | 'deuterium') => s.res[k] + s.shipsValue[k] - s.lostValue[k];
  return { metal: of('metal'), crystal: of('crystal'), deuterium: of('deuterium') };
}

/** Where a period's value came from, in MSU: each resource at its rate, then the ships found (dark matter has no MSU). */
export function valueMix(s: PeriodStats): { metal: number; crystal: number; deuterium: number; ships: number } {
  return { metal: s.res.metal, crystal: s.res.crystal * 1.5, deuterium: s.res.deuterium * 3, ships: msu(s.shipsValue) };
}

/** Raids: how many, loot and harvested debris together (`debris` = the harvested part), ships lost. */
export interface RaidStats {
  count: number;
  res: Res4;
  debris: Res4;
  lost: Record<number, number>;
  lostValue: Res4;
  netMsu: number;
}

export function raidStats(entries: JournalEntry[]): RaidStats {
  const s: RaidStats = { count: 0, res: ZERO(), debris: ZERO(), lost: {}, lostValue: ZERO(), netMsu: 0 };
  for (const e of entries) {
    if (e.kind !== 'raid') continue;
    if (!e.debris) s.count += e.summary?.count ?? 1;
    for (const r of e.debris ? [s.res, s.debris] : [s.res]) {
      r.metal += e.res.metal;
      r.crystal += e.res.crystal;
      r.deuterium += e.res.deuterium;
    }
    for (const [id, n] of Object.entries(e.lost)) s.lost[Number(id)] = (s.lost[Number(id)] ?? 0) + n;
  }
  s.lostValue = unitsValue(s.lost);
  s.netMsu = msu(s.res) - msu(s.lostValue);
  return s;
}
