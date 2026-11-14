/**
 * Project Orion (anomalies), pure maths. Ported from Nicola's "OGame Orion Calculator" 1.3.7:
 * - how much a scanned anomaly or an active mission pays per hour of lithium production;
 * - the lithium bar over time, with what the anomalies already under way will want when they end;
 * - the archive of the anomalies taken on (collections, fuel, battles), summed per period.
 * No DOM, no network: the readers are in data/orion.ts, the page work in modules/orion.
 */
import { msu, unitsValue } from './expeditions';

export const LEDGER_KEY = 'orion.ledger';
export const IGNORED_KEY = 'orion.ignored';
export const ARCHIVE_KEY = 'orion.archive';
export const PENDING_KEY = 'orion.pending';
/** Set once the Orion Calculator's own data (page localStorage) has been copied in. */
export const IMPORTED_KEY = 'orion.imported';

const HOUR = 3_600_000;

export interface Res3 {
  metal: number;
  crystal: number;
  deuterium: number;
}

/** What a list of reward lines holds: resources by their icon, lithium apart, anything else as its text. */
export interface Rewards extends Res3 {
  lithium: number;
  other: string[];
}

export const noRewards = (): Rewards => ({ metal: 0, crystal: 0, deuterium: 0, lithium: 0, other: [] });

// ---------- profitability ----------

export interface Profit {
  /** Ranking value: MSU per hour of lithium production (per 1M lithium without the production); -1 without a cost. */
  index: number;
  /** Lithium the redemption really costs: the cost minus the lithium it gives back. */
  net: number;
  /** The lithium back covers the cost: ranked above every other. */
  free: boolean;
  /** Hours of production the net cost takes (0 when unknown). */
  hours: number;
  msu: number;
}

/**
 * The index: the rewards in MSU per hour of the player's lithium production the redemption costs.
 * The scan cost is left out: it is already paid when the results are on screen.
 */
export function profit(cost: number, rewards: Rewards, perHour: number): Profit {
  const value = msu(rewards);
  const net = cost - rewards.lithium;
  if (!cost) return { index: -1, net: 0, free: false, hours: 0, msu: value };
  if (net <= 0) return { index: 1e18 + value, net, free: true, hours: 0, msu: value };
  return { index: perHour > 0 ? (value * perHour) / net : (value * 1e6) / net, net, free: false, hours: perHour > 0 ? net / perHour : 0, msu: value };
}

// ---------- the anomalies under way (ledger) ----------

/**
 * One anomaly already taken on, keyed by its coordinates (the one thing the scanner card and the
 * mission share). cost / lithium are the WHOLE redemption at the last wave.
 * - 'scanner': noted at Discover from the card's figures; ends when the mission would if flown at once.
 * - 'mission': rewritten every time the missions tab is drawn, with the real end and projected totals.
 */
export interface LedgerRecord {
  coords: string;
  name: string;
  cost: number;
  lithium: number;
  endAt: number;
  source: 'scanner' | 'mission';
  at: number;
  /** Cost so far only: no wave done yet, the total is not known. */
  partial?: boolean;
  /** Rewards in MSU the scanner showed at Discover (kept when the mission takes over). */
  msu?: number;
}
export type Ledger = Record<string, LedgerRecord>;
/** Anomalies the player leaves out of the lithium planning, by coordinates. */
export type Ignored = Record<string, true>;

/** A scanner record the missions tab never confirmed is forgotten after a day. */
export const SCANNER_TTL = 24 * HOUR;

export function pruneLedger(ledger: Ledger, now: number): { ledger: Ledger; changed: boolean } {
  const out: Ledger = {};
  let changed = false;
  for (const [k, r] of Object.entries(ledger)) {
    if (r.source === 'scanner' && now - r.at > SCANNER_TTL) changed = true;
    else out[k] = r;
  }
  return { ledger: changed ? out : ledger, changed };
}

/** The records that count: every remembered one but those the player ignores. */
export const counted = (ledger: Ledger, ignored: Ignored): LedgerRecord[] => Object.values(ledger).filter((r) => !ignored[r.coords]);

/**
 * An active mission projected onto its last wave. The collect cost grows by the same amount every
 * wave, so total = now / waves done * all waves. "Wave 2 / 7" is the one on its way: one fewer is
 * done. The total never shrinks: the largest figure ever seen wins (the scanner's included).
 */
export function projectMission(now: { cost: number; lithium: number }, wave: { incoming: number; total: number }, seconds: number, known: LedgerRecord | undefined, at: number): Pick<LedgerRecord, 'cost' | 'lithium' | 'partial' | 'endAt'> {
  const done = wave.total ? Math.max(0, wave.incoming - 1) : 0;
  const scale = wave.total && done ? wave.total / done : 0;
  const cost = Math.max(scale ? Math.round(now.cost * scale) : now.cost, known?.cost ?? 0);
  const lithium = Math.max(scale ? Math.round(now.lithium * scale) : now.lithium, known?.lithium ?? 0);
  return {
    cost,
    lithium,
    partial: !scale && !((known?.cost ?? 0) > now.cost) && !!wave.total && done < wave.total,
    endAt: seconds ? at + seconds * 1000 : (known?.endAt ?? at),
  };
}

/** The missions tab is the full list: write each mission, drop the missions it no longer lists. Scanner records stay. */
export function syncLedger(ledger: Ledger, missions: { coords: string; name: string; cost: number; lithium: number; incoming: number; total: number; seconds: number; totalCost?: number; possible?: Rewards }[], now: number): Ledger {
  const out: Ledger = {};
  for (const [k, r] of Object.entries(ledger)) if (r.source !== 'mission') out[k] = r;
  for (const m of missions) {
    if (!m.coords) continue;
    const known = ledger[m.coords];
    const p = projectMission(m, { incoming: m.incoming, total: m.total }, m.seconds, known, now);
    // The card's details give the whole mission's reward cost and possible rewards: better than the projection.
    const total = m.totalCost ?? 0;
    const value = m.possible ? msu(m.possible) : 0;
    out[m.coords] = {
      coords: m.coords,
      name: m.name || m.coords,
      ...p,
      cost: Math.max(p.cost, total),
      lithium: Math.max(p.lithium, m.possible?.lithium ?? 0),
      partial: p.partial && !total,
      source: 'mission',
      at: now,
      ...(value || known?.msu ? { msu: value || known!.msu } : {}),
    };
  }
  return out;
}

// ---------- the lithium bar over time ----------

export interface Lithium {
  /** In the bar now. */
  now: number;
  perHour: number;
  /** Hours until the resources being converted run out (Infinity = never). */
  stopsIn: number;
  /** Storage: production stops when the bar is this full (Infinity = unknown). Rewards may go over it. */
  cap: number;
}

export interface Due {
  h: number;
  /** Cost minus lithium back. */
  net: number;
  record: LedgerRecord;
}

/** Each anomaly as a checkpoint, hours from now (one already over is due now), earliest first. */
export function dueList(records: LedgerRecord[], now: number): Due[] {
  return records.map((r) => ({ h: Math.max(0, (r.endAt - now) / HOUR), net: (r.cost || 0) - (r.lithium || 0), record: r })).sort((a, b) => a.h - b.h);
}

/**
 * The bar `h` hours from now: lithium now, plus production (until the conversion runs dry, and only
 * while the storage is not full), minus each anomaly's net cost at its own end.
 */
export function poolAt(l: Lithium, due: Due[], h: number): number {
  let pool = l.now;
  let t = 0;
  const run = (to: number) => {
    const hours = Math.max(0, Math.min(to, l.stopsIn) - Math.min(t, l.stopsIn));
    if (hours > 0 && l.perHour > 0 && pool < l.cap) pool = Math.min(l.cap, pool + l.perHour * hours);
    t = Math.max(t, to);
  };
  for (const d of due) {
    if (d.h > h) break;
    run(d.h);
    pool -= d.net;
  }
  run(h);
  return pool;
}

export interface LaunchPlan {
  /** Lithium free for this anomaly at its collection. */
  free: number;
  /** Waves that lithium pays for (the cost is split evenly over the waves, as the rewards are). */
  covered: number;
  waves: number;
  due: LedgerRecord[];
  /** Held back for the anomalies under way. */
  reserved: number;
  /** Rewards of the covered waves, in MSU. */
  msu: number;
  /** Hours from now to launch so that all waves are covered (that late or later); null = never (production stops first). */
  wait: number | null;
}

/**
 * Launching now and collecting at the end. Every anomaly already taken on is paid when IT ends, so
 * the lithium free for this one is the LOWEST the bar would go from this one's collection onwards.
 * This one's own lithium back arrives with its collection: it helps the later checkpoints, it cannot
 * pay for itself. The card's own coordinates are left out, should a record for it exist.
 */
export function launchPlan(card: { cost: number; lithium: number; msu: number }, hours: number, waves: number, l: Lithium, records: LedgerRecord[], ownCoords: string, now: number): LaunchPlan | null {
  // Without production (conversion idle) the plan still holds: the bar only goes down.
  if (!(hours > 0) || !(waves > 0) || !card.cost) return null;
  const due = dueList(records.filter((r) => r.coords !== ownCoords), now);
  const freeAt = (h: number) => Math.min(poolAt(l, due, h), ...due.filter((d) => d.h > h).map((d) => poolAt(l, due, d.h) + card.lithium));
  const free = freeAt(hours);
  const covered = Math.max(0, Math.min(waves, Math.floor(free / (card.cost / waves))));
  // freeAt only grows with a later collection (a minimum over fewer checkpoints): the earliest launch
  // that covers everything is found by halving. Past the last checkpoint, the end of the conversion
  // and a full storage nothing changes any more: if it is not enough there, it never is.
  let wait: number | null = 0;
  if (free < card.cost) {
    const totalNet = due.reduce((s, d) => s + d.net, 0);
    const last = due.length ? due[due.length - 1]!.h : 0;
    const producing = l.perHour > 0 && l.stopsIn > 0;
    const fill = producing && Number.isFinite(l.cap) ? last + l.cap / l.perHour : 0;
    const need = !producing ? 0 : Number.isFinite(l.stopsIn) ? l.stopsIn : (card.cost + totalNet - l.now) / l.perHour;
    const top = Math.max(hours, last, fill, need) + 1;
    if (freeAt(top) < card.cost) wait = null;
    else {
      let lo = hours;
      let hi = top;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (freeAt(mid) >= card.cost) hi = mid;
        else lo = mid;
      }
      wait = hi - hours;
    }
  }
  return { free, covered, waves, due: due.map((d) => d.record), reserved: Math.max(0, poolAt(l, [], hours) - free), msu: (card.msu * covered) / waves, wait };
}

/**
 * How many scans the bar can pay now. A scan is paid on the spot, so the lithium free for scans is
 * the lowest the bar would go from now on, every anomaly under way paid at its end. What a scan might
 * find is not known yet, so nothing is reserved for it.
 */
export function scansPossible(l: Lithium, records: LedgerRecord[], scanCost: number, now: number): { cost: number; free: number; count: number } | null {
  if (!scanCost) return null;
  const free = freeLithium(l, records, now);
  return { cost: scanCost, free, count: Math.max(0, Math.floor(free / scanCost)) };
}

/** Lithium free to spend now: the lowest the bar would go from now on, every anomaly under way paid at its end. */
export function freeLithium(l: Lithium, records: LedgerRecord[], now: number): number {
  const due = dueList(records, now);
  return Math.min(poolAt(l, due, 0), ...due.map((d) => poolAt(l, due, d.h)));
}

// ---------- the archive ----------

export interface Collection extends Res3 {
  at: number;
  wave: number;
  waves: number;
  /** Lithium paid. */
  cost: number;
  /** Lithium received. */
  lithium: number;
  other: string[];
}

export interface Entry {
  /** The game's own id for the anomaly (data-space-object-id). */
  id: string;
  name: string;
  coords: string;
  level: number;
  stars: number;
  mode: string;
  kind: string;
  spawnedAt: number;
  wave: number;
  waves: number;
  /** The coordinates are the anomaly's own (entries of the Orion Calculator before 1.3.2 lack this). */
  located?: boolean;
  firstSeen: number;
  lastSeen: number;
  status: 'running' | 'collected' | 'expired';
  endedAt: number;
  collections: Collection[];
}

export interface Fuel {
  at: number;
  coords: string;
  deut: number;
  mission: number;
}

export interface Battle {
  at: number;
  coords: string;
  entry: string;
  lost: Record<string, number>;
  won: boolean;
  draw: boolean;
}

export interface Archive {
  entries: Record<string, Entry>;
  fuel: Fuel[];
  battles: Record<string, Battle>;
}

export const emptyArchive = (): Archive => ({ entries: {}, fuel: [], battles: {} });

export function loadArchive(raw: Partial<Archive> | null | undefined): Archive {
  return { entries: raw?.entries ?? {}, fuel: raw?.fuel ?? [], battles: raw?.battles ?? {} };
}

/** What a mission card says about its anomaly. */
export interface MissionSeen {
  id: string;
  name: string;
  coords: string;
  level: number;
  stars: number;
  mode: string;
  kind: string;
  spawnedAt: number;
  wave: number;
  waves: number;
}

/** The missions tab: each anomaly listed written down or updated; one no longer listed is closed. */
export function syncArchive(archive: Archive, seen: MissionSeen[], now: number): Archive {
  const entries = { ...archive.entries };
  const listed = new Set<string>();
  for (const s of seen) {
    if (!s.id) continue;
    listed.add(s.id);
    const old: Entry = entries[s.id] ?? { id: s.id, name: '', coords: '', level: 0, stars: 0, mode: '', kind: '', spawnedAt: 0, wave: 0, waves: 0, firstSeen: now, lastSeen: now, status: 'running', endedAt: 0, collections: [] };
    // Never blank what was known.
    const known = Object.fromEntries(Object.entries(s).filter(([, v]) => v !== '' && v !== 0));
    entries[s.id] = { ...old, ...known, ...(s.coords ? { located: true } : {}), wave: Math.max(old.wave, s.wave), lastSeen: now, status: 'running', endedAt: 0 } as Entry;
  }
  for (const e of Object.values(entries)) {
    if (e.status === 'running' && !listed.has(e.id)) entries[e.id] = { ...e, status: e.collections.length ? 'collected' : 'expired', endedAt: now };
    // Its collection is settled a moment after the card goes.
    else if (e.status === 'expired' && e.collections.length) entries[e.id] = { ...e, status: 'collected' };
  }
  return { ...archive, entries };
}

// ---------- collections ----------

/** "Esperienza delle Forme di vita 15.794" → ['Esperienza delle Forme di vita', 15794]; null without a plain number at the end. */
export function splitCount(text: string): [string, number] | null {
  const m = /^(.*?)\s*(\d[\d.,' ]*)$/.exec(text.replace(/\s+/g, ' ').trim());
  return m && m[1] ? [m[1], Number(m[2]!.replace(/\D/g, '')) || 0] : null;
}

/**
 * Only what was really collected counts, never what the dialog or the card promised: each resource
 * at most what left the card between the click (`before`) and the payout (`after`, null = card gone).
 * Non-resource lines with a plain count likewise; anything else is kept as read.
 */
export function collectedOnly(r: Rewards, before: Rewards | null, after: Rewards | null): Rewards {
  if (!before) return r;
  const out: Rewards = { ...r, other: [] };
  for (const k of ['metal', 'crystal', 'deuterium', 'lithium'] as const) out[k] = Math.min(r[k] || 0, Math.max(0, (before[k] || 0) - (after ? after[k] || 0 : 0)));
  const counts = (list: string[]) =>
    list.reduce<Record<string, number>>((acc, text) => {
      const x = splitCount(text);
      if (x) acc[x[0]] = (acc[x[0]] ?? 0) + x[1];
      return acc;
    }, {});
  const had = counts(before.other);
  const still = after ? counts(after.other) : {};
  for (const text of r.other) {
    const x = splitCount(text);
    if (!x || !(x[0] in had)) {
      out.other.push(text);
      continue;
    }
    const n = Math.min(x[1], Math.max(0, had[x[0]]! - (still[x[0]] ?? 0)));
    if (n) out.other.push(n === x[1] ? text : `${x[0]} ${n}`);
  }
  return out;
}

/** A collect clicked, waiting for the game to pay out. */
export interface Pending {
  at: number;
  /** 'dialog' = Accept in the collect dialog; 'card' = the card's own button (no dialog that day). */
  via: 'dialog' | 'card';
  cost: number;
  rewards: Rewards;
  /** The card's rewards at the click. */
  before: Rewards | null;
  /** What was waiting on the card at the click: collect cost, and rewards in MSU + lithium. */
  cardCost: number;
  cardValue: number;
  wave: number;
  waves: number;
  /** Since when the card is missing from the list (it may only be being redrawn). */
  goneSince?: number;
}
export type PendingMap = Record<string, Pending>;

export const PENDING_TTL = 60_000;
/** A card missing this long is really gone, not being redrawn. */
export const GONE_SETTLE = 3_000;

/** A mission card as the settlement needs it. */
export interface CardState {
  cost: number;
  value: number;
  rewards: Rewards;
}

export const cardValue = (r: Rewards): number => msu(r) + r.lithium;

/**
 * Has the game paid out? Not "the card changed": a wave arriving changes it too. Only what was
 * waiting on the card going DOWN says so, or the card staying gone. A payout becomes a collection of
 * its anomaly; a note nothing came of is forgotten after a minute.
 */
export function settle(pending: PendingMap, archive: Archive, cards: Map<string, CardState>, dialogFor: (id: string) => boolean, now: number): { pending: PendingMap; archive: Archive; changed: boolean } {
  const out: PendingMap = {};
  const entries = { ...archive.entries };
  let changed = false;
  for (const [id, p] of Object.entries(pending)) {
    // A dialog came late after all: the card-button note is not a collection, Accept will be.
    if (p.via === 'card' && dialogFor(id)) {
      changed = true;
      continue;
    }
    const card = cards.get(id);
    if (card) {
      const q = p.goneSince ? (({ goneSince: _g, ...rest }) => rest)(p) : p;
      if (p.goneSince) changed = true;
      const paid = q.cardCost ? card.cost < q.cardCost : card.value < q.cardValue;
      if (!paid) {
        if (now - q.at > PENDING_TTL) changed = true;
        else out[id] = q;
        continue;
      }
    } else {
      if (!p.goneSince) {
        out[id] = { ...p, goneSince: now };
        changed = true;
        continue;
      }
      if (now - p.goneSince < GONE_SETTLE) {
        out[id] = p;
        continue;
      }
    }
    const entry = entries[id];
    if (entry) {
      const r = collectedOnly(p.rewards, p.before, card ? card.rewards : null);
      entries[id] = { ...entry, collections: [...entry.collections, { at: p.at, wave: p.wave, waves: p.waves, cost: p.cost, lithium: r.lithium, metal: r.metal, crystal: r.crystal, deuterium: r.deuterium, other: r.other }] };
    }
    changed = true;
  }
  return { pending: out, archive: { ...archive, entries }, changed };
}

// ---------- fuel and battles ----------

/** The game's anomaly mission (its own "Send fleet" link on an anomaly card), and deep space as the target type. */
export const ANOMALY_MISSION = 14;
export const DEEP_SPACE = 4;

const MARGIN = 12 * HOUR;

/** The anomaly an event at `coords` / `at` belongs to: the same coordinates host several anomalies over time. */
export function matchEntry(entries: Entry[], coords: string, at: number, now: number): Entry | null {
  const fits = entries.filter((e) => e.coords === coords && at >= (e.spawnedAt || e.firstSeen || 0) - MARGIN && at <= (e.endedAt || now) + MARGIN);
  const start = (e: Entry) => e.spawnedAt || e.firstSeen;
  return fits.sort((a, b) => Math.abs(at - start(a)) - Math.abs(at - start(b)))[0] ?? null;
}

/** A fleet sent: kept when it went to an anomaly (deep space, the anomaly mission, or coordinates the archive knows). */
export function noteFuel(archive: Archive, f: Fuel & { type: number }): Archive | null {
  if (!(f.deut > 0)) return null;
  const known = new Set(Object.values(archive.entries).filter((e) => e.located).map((e) => e.coords));
  if (!(f.type === DEEP_SPACE || f.mission === ANOMALY_MISSION || known.has(f.coords))) return null;
  return { ...archive, fuel: [...archive.fuel, { at: f.at, coords: f.coords, deut: f.deut, mission: f.mission }] };
}

/**
 * A combat report at an anomaly: the player's own ships destroyed in the last round. It counts when
 * it names an archived anomaly by id (the report's defender space object), or falls at its
 * coordinates during its life; a battle on a planet or moon never does.
 */
export function noteBattle(archive: Archive, b: { id: string; at: number; coords: string; targetType?: string; targetId?: string; lost: Record<number, number>; won: boolean; draw: boolean }, now: number): Archive | null {
  if (!b.id || archive.battles[b.id]) return null;
  if (b.targetType && b.targetType !== 'anomaly') return null;
  const byId = b.targetId ? archive.entries[b.targetId] : undefined;
  const entry = byId ?? matchEntry(Object.values(archive.entries).filter((e) => e.located), b.coords, b.at, now);
  if (!entry) return null;
  const entries = !entry.located && b.coords ? { ...archive.entries, [entry.id]: { ...entry, coords: b.coords, located: true } } : archive.entries;
  const lost = Object.fromEntries(Object.entries(b.lost).map(([k, n]) => [k, n]));
  return { ...archive, entries, battles: { ...archive.battles, [b.id]: { at: b.at, coords: b.coords, entry: entry.id, lost, won: b.won, draw: b.draw } } };
}

// ---------- per period ----------

export type OrionEvent = { at: number; entry: string } & ({ kind: 'collect'; c: Collection } | { kind: 'fuel'; deut: number } | { kind: 'battle'; lost: Record<string, number> });

/**
 * Every dated event, each tied to its anomaly. A flight to one of the player's own planets is left
 * out unless it carries the anomaly mission (the Orion Calculator before 1.3.2 noted flights home).
 */
export function orionEvents(archive: Archive, home: Set<string>, now: number): OrionEvent[] {
  const entries = Object.values(archive.entries);
  const located = entries.filter((e) => e.located);
  const out: OrionEvent[] = [];
  for (const e of entries) for (const c of e.collections) out.push({ kind: 'collect', at: c.at, entry: e.id, c });
  for (const f of archive.fuel) {
    if (f.mission !== ANOMALY_MISSION && home.has(f.coords)) continue;
    out.push({ kind: 'fuel', at: f.at, entry: matchEntry(located, f.coords, f.at, now)?.id ?? '', deut: f.deut });
  }
  for (const b of Object.values(archive.battles)) out.push({ kind: 'battle', at: b.at, entry: b.entry, lost: b.lost });
  return out;
}

export interface OrionTotals {
  collections: number;
  waves: number;
  /** Lithium paid and received. */
  paid: number;
  back: number;
  res: Res3;
  /** Resource rewards in MSU. */
  gain: number;
  other: string[];
  /** Ships received as rewards, by id, and their build cost in MSU. */
  got: Record<string, number>;
  gotN: number;
  gotMsu: number;
  fuel: number;
  fuelMsu: number;
  battles: number;
  lost: Record<string, number>;
  lostN: number;
  lostMsu: number;
}

export const noTotals = (): OrionTotals => ({ collections: 0, waves: 0, paid: 0, back: 0, res: { metal: 0, crystal: 0, deuterium: 0 }, gain: 0, other: [], got: {}, gotN: 0, gotMsu: 0, fuel: 0, fuelMsu: 0, battles: 0, lost: {}, lostN: 0, lostMsu: 0 });

const unitsMsu = (units: Record<string, number>) => msu(unitsValue(Object.fromEntries(Object.entries(units).map(([k, n]) => [Number(k), n]))));

/**
 * Sums events. A reward line that names a ship (`shipOf`) is a ship received, valued at its build
 * cost like ships lost; any other non-resource reward stays under "other", not valued.
 */
export function orionTotals(events: OrionEvent[], shipOf: (text: string) => { id: number; n: number } | null): OrionTotals {
  const t = noTotals();
  for (const ev of events) {
    if (ev.kind === 'collect') {
      const c = ev.c;
      t.collections++;
      t.waves += c.waves || 0;
      t.paid += c.cost || 0;
      t.back += c.lithium || 0;
      t.res.metal += c.metal || 0;
      t.res.crystal += c.crystal || 0;
      t.res.deuterium += c.deuterium || 0;
      t.gain += msu(c);
      for (const text of c.other ?? []) {
        const ship = shipOf(text);
        if (!ship) {
          t.other.push(text);
          continue;
        }
        t.got[ship.id] = (t.got[ship.id] ?? 0) + ship.n;
        t.gotN += ship.n;
        t.gotMsu += unitsMsu({ [ship.id]: ship.n });
      }
    } else if (ev.kind === 'fuel') {
      t.fuel += ev.deut || 0;
      t.fuelMsu += msu({ metal: 0, crystal: 0, deuterium: ev.deut || 0 });
    } else {
      t.battles++;
      for (const [id, n] of Object.entries(ev.lost)) {
        t.lost[id] = (t.lost[id] ?? 0) + n;
        t.lostN += n;
      }
      t.lostMsu += unitsMsu(ev.lost);
    }
  }
  return t;
}

/** Rewards + ships received − ships lost − fuel, in MSU (lithium apart). */
export const balance = (t: OrionTotals): number => t.gain + t.gotMsu - t.lostMsu - t.fuelMsu;

/** Reads "<ship name> <count>" with the names given (longest first, so "Incrociatore da battaglia" is not "Incrociatore"). */
export function shipMatcher(names: [number, string][]): (text: string) => { id: number; n: number } | null {
  const list = names.filter(([, n]) => n).sort((a, b) => b[1].length - a[1].length);
  return (text) => {
    const tx = text.replace(/\s+/g, ' ').trim().toLowerCase();
    const hit = list.find(([, name]) => tx.startsWith(name.toLowerCase()) && !/[a-zà-ÿ]/i.test(tx.charAt(name.length)));
    if (!hit) return null;
    const n = Number(tx.slice(hit[1].length).replace(/\D/g, '')) || 0;
    return n ? { id: hit[0], n } : null;
  };
}

/** "Other" with the same reward added up; a line without a plain number listed once with ×count. */
export function otherSummary(list: string[], locale: string): string {
  const sums = new Map<string, { n: number; times: number; counted: boolean }>();
  for (const text of list) {
    const x = splitCount(text);
    const key = x ? x[0] : text.replace(/\s+/g, ' ').trim();
    const cur = sums.get(key) ?? { n: 0, times: 0, counted: !!x };
    if (x) cur.n += x[1];
    cur.times++;
    sums.set(key, cur);
  }
  return [...sums].map(([name, v]) => (v.counted ? `${name} ${v.n.toLocaleString(locale)}` : name + (v.times > 1 ? ` ×${v.times}` : ''))).join(', ');
}

// ---------- the Orion Calculator's own data ----------

/**
 * One-time copy of what the Orion Calculator userscript kept in the page's localStorage
 * ("orionArchive.v1", "orionAddons.anomalies", "orionAddons.ignored"): what Future already has wins.
 * Its battles noted before 1.3.2 (no `v`) were fights at home and are left out; its collections keep
 * their resources, the MSU is computed again with Future's rates.
 */
export function importLegacy(cur: { archive: Archive; ledger: Ledger; ignored: Ignored }, old: { archive?: unknown; ledger?: unknown; ignored?: unknown }): { archive: Archive; ledger: Ledger; ignored: Ignored } {
  const a = (old.archive ?? {}) as { entries?: Record<string, Partial<Entry> & { collections?: Partial<Collection>[] }>; fuel?: Partial<Fuel>[]; battles?: Record<string, Partial<Battle> & { v?: number }> };
  const entries = { ...cur.archive.entries };
  for (const [id, e] of Object.entries(a.entries ?? {})) {
    if (entries[id] || !e) continue;
    entries[id] = {
      id,
      name: e.name ?? '',
      coords: e.coords ?? '',
      level: e.level ?? 0,
      stars: e.stars ?? 0,
      mode: e.mode ?? '',
      kind: e.kind ?? '',
      spawnedAt: e.spawnedAt ?? 0,
      wave: e.wave ?? 0,
      waves: e.waves ?? 0,
      ...(e.located ? { located: true } : {}),
      firstSeen: e.firstSeen ?? 0,
      lastSeen: e.lastSeen ?? 0,
      status: e.status === 'collected' || e.status === 'expired' ? e.status : 'running',
      endedAt: e.endedAt ?? 0,
      collections: (e.collections ?? []).map((c) => ({ at: c.at ?? 0, wave: c.wave ?? 0, waves: c.waves ?? 0, cost: c.cost ?? 0, lithium: c.lithium ?? 0, metal: c.metal ?? 0, crystal: c.crystal ?? 0, deuterium: c.deuterium ?? 0, other: c.other ?? [] })),
    };
  }
  const seenFuel = new Set(cur.archive.fuel.map((f) => `${f.at}|${f.coords}`));
  const fuel = [...cur.archive.fuel];
  for (const f of a.fuel ?? []) {
    if (!f.at || !f.coords || seenFuel.has(`${f.at}|${f.coords}`)) continue;
    fuel.push({ at: f.at, coords: f.coords, deut: f.deut ?? 0, mission: f.mission ?? 0 });
  }
  const battles = { ...cur.archive.battles };
  for (const [id, b] of Object.entries(a.battles ?? {})) {
    if (battles[id] || !b?.v) continue;
    battles[id] = { at: b.at ?? 0, coords: b.coords ?? '', entry: b.entry ?? '', lost: b.lost ?? {}, won: !!b.won, draw: !!b.draw };
  }
  const ledger = { ...cur.ledger };
  for (const [k, r] of Object.entries((old.ledger ?? {}) as Ledger)) if (!ledger[k] && r?.coords) ledger[k] = r;
  const ignored = { ...cur.ignored };
  for (const k of Object.keys((old.ignored ?? {}) as Ignored)) ignored[k] = true;
  return { archive: { entries, fuel, battles }, ledger, ignored };
}
