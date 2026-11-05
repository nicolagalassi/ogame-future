/**
 * Account-wide figures for the dashboard, computed from the stored snapshot and the
 * game's planet list. Pure functions: no DOM writes, no network.
 */
import type { AccountSnapshot, Resources } from '../data/account-info';
import type { PlanetListEntry } from '../data/planet-list';
import { activeItems, type QueueSnapshot } from '../data/queues';
import { effectiveStorage, estimateResources, storageFill } from './resources';

const KEYS = ['metal', 'crystal', 'deuterium'] as const;
type Key = (typeof KEYS)[number];

/** Metal-standard units at 3:2:1. */
export const msu = (r: Resources): number => r.metal + r.crystal * 1.5 + r.deuterium * 3;

export interface BodyRow {
  id: number;
  type: 'planet' | 'moon';
  name: string;
  coords: string;
  amount: Resources;
  perHour: Resources;
  fill: Resources | null;
  /** Hours until each storage is full: 0 = already full, null = not filling or unknown. */
  hoursToFull: { metal: number | null; crystal: number | null; deuterium: number | null };
  /** Minutes since the numbers were last read. */
  ageMinutes: number;
  /** Mine levels: metal mine (1), crystal mine (2), deuterium synthesizer (3). */
  mines: Resources;
  /** true = nothing in construction (planets only), null = unknown. */
  idle: boolean | null;
}

/**
 * Builds the rows. Idle = no building or lifeform building running: from the production
 * queues when known, otherwise from the game's construction icon in the planet list.
 */
export function bodyRows(
  snapshot: AccountSnapshot | null,
  entries: PlanetListEntry[],
  now: number,
  queues: QueueSnapshot | null = null,
): BodyRow[] {
  if (!snapshot) return [];
  const byId = new Map(snapshot.bodies.map((b) => [b.id, b]));
  const rows: BodyRow[] = [];
  for (const entry of entries) {
    for (const type of ['planet', 'moon'] as const) {
      const id = type === 'planet' ? entry.planetId : entry.moonId;
      const body = id ? byId.get(id) : undefined;
      if (!body) continue;
      const amount = estimateResources(body, now);
      const cap = effectiveStorage(body);
      const perHour = type === 'planet' ? { ...body.production } : { metal: 0, crystal: 0, deuterium: 0 };
      const toFull = (k: Key): number | null => {
        if (cap[k] <= 0) return null;
        if (amount[k] >= cap[k]) return 0;
        return perHour[k] > 0 ? (cap[k] - amount[k]) / perHour[k] : null;
      };
      rows.push({
        id: body.id,
        type,
        name: type === 'planet' ? entry.name || body.name : body.name || entry.name,
        coords: entry.coords || body.coords,
        amount,
        perHour,
        fill: storageFill(body, amount),
        hoursToFull: { metal: toFull('metal'), crystal: toFull('crystal'), deuterium: toFull('deuterium') },
        ageMinutes: Math.max(0, Math.floor((now - body.resourcesAt) / 60_000)),
        mines: { metal: body.levels['1'] ?? 0, crystal: body.levels['2'] ?? 0, deuterium: body.levels['3'] ?? 0 },
        idle:
          type !== 'planet'
            ? null
            : queues
              ? !activeItems(queues.bodies[String(body.id)], now).some((i) => i.kind === 'building' || i.kind === 'lfbuilding')
              : !entry.construction.planet,
      });
    }
  }
  return rows;
}

export interface AccountSummary {
  stock: Resources;
  perHour: Resources;
  planets: number;
  moons: number;
  idle: number;
}

export function summarize(rows: BodyRow[]): AccountSummary {
  const stock = { metal: 0, crystal: 0, deuterium: 0 };
  const perHour = { metal: 0, crystal: 0, deuterium: 0 };
  for (const row of rows) for (const k of KEYS) {
    stock[k] += row.amount[k];
    perHour[k] += row.perHour[k];
  }
  return {
    stock,
    perHour,
    planets: rows.filter((r) => r.type === 'planet').length,
    moons: rows.filter((r) => r.type === 'moon').length,
    idle: rows.filter((r) => r.idle === true).length,
  };
}

export interface AccountAlert {
  level: 'warn' | 'info';
  /** i18n key of the title; body lists the bodies concerned. */
  key: 'alert.missing' | 'alert.full' | 'alert.soonFull' | 'alert.idle' | 'alert.stale';
  count: number;
  names: string[];
}

/** Hours ahead for the "storage full soon" warning. */
export const SOON_FULL_HOURS = 6;
/** Data older than this many minutes counts as stale. */
export const STALE_MINUTES = 60;

export function accountAlerts(rows: BodyRow[], snapshot: AccountSnapshot | null, entries: PlanetListEntry[]): AccountAlert[] {
  const label = (r: { name: string; coords: string }) => `${r.name} [${r.coords}]`;
  const known = new Set((snapshot?.bodies ?? []).map((b) => b.id));
  const missing = entries.filter((e) => (e.planetId && !known.has(e.planetId)) || (e.moonId && !known.has(e.moonId)));
  const planets = rows.filter((r) => r.type === 'planet');
  const minHours = (r: BodyRow) => {
    const hours = KEYS.map((k) => r.hoursToFull[k]).filter((h): h is number => h !== null);
    return hours.length ? Math.min(...hours) : null;
  };
  const full = planets.filter((r) => minHours(r) === 0 || (r.fill !== null && KEYS.some((k) => r.fill![k] >= 0.9)));
  const soon = planets.filter((r) => !full.includes(r) && (minHours(r) ?? Infinity) <= SOON_FULL_HOURS);
  const idle = planets.filter((r) => r.idle === true);
  const stale = rows.filter((r) => r.ageMinutes > STALE_MINUTES);

  const out: AccountAlert[] = [];
  const push = (level: AccountAlert['level'], key: AccountAlert['key'], list: { name: string; coords: string }[]) => {
    if (list.length) out.push({ level, key, count: list.length, names: list.map(label) });
  };
  push('warn', 'alert.missing', missing);
  push('warn', 'alert.full', full);
  push('warn', 'alert.soonFull', soon);
  push('info', 'alert.idle', idle);
  push('info', 'alert.stale', stale);
  return out;
}
