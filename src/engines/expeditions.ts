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
  /** 'raid' only comes from an OGLight import (Future does not read combat loot itself). */
  kind: ExpeditionMessage['kind'] | 'raid';
  /** Losses from the combat report at position 16 (pirates/aliens), not a separate expedition. */
  combat?: boolean;
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
  for (const { id, ...entry } of messages) {
    if (next[id]) continue;
    if (next === journal) next = { ...journal };
    next[id] = entry;
    added++;
  }
  return { journal: next, added };
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
    netMsu: 0,
  };
  for (const e of entries) {
    if (e.kind === 'raid') continue;
    const n = e.summary ? e.summary.count : 1;
    if (e.kind === 'discovery') s.discoveries += n;
    else if (!e.combat) s.count += n;
    if (e.summary) for (const [k, v] of Object.entries(e.summary.outcomes)) s.outcomes[k as Outcome] = (s.outcomes[k as Outcome] ?? 0) + (v ?? 0);
    else if (!e.combat) s.outcomes[e.result] = (s.outcomes[e.result] ?? 0) + 1;
    s.res.metal += e.res.metal;
    s.res.crystal += e.res.crystal;
    s.res.deuterium += e.res.deuterium;
    s.res.darkMatter += e.res.darkMatter;
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

/** Raids (from an OGLight import): how many, loot, ships lost. */
export interface RaidStats {
  count: number;
  res: Res4;
  lost: Record<number, number>;
  lostValue: Res4;
  netMsu: number;
}

export function raidStats(entries: JournalEntry[]): RaidStats {
  const s: RaidStats = { count: 0, res: ZERO(), lost: {}, lostValue: ZERO(), netMsu: 0 };
  for (const e of entries) {
    if (e.kind !== 'raid') continue;
    s.count += e.summary?.count ?? 1;
    s.res.metal += e.res.metal;
    s.res.crystal += e.res.crystal;
    s.res.deuterium += e.res.deuterium;
    for (const [id, n] of Object.entries(e.lost)) s.lost[Number(id)] = (s.lost[Number(id)] ?? 0) + n;
  }
  s.lostValue = unitsValue(s.lost);
  s.netMsu = msu(s.res) - msu(s.lostValue);
  return s;
}
