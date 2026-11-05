/**
 * Resource collection planner: how many Large Cargos each body needs to send its
 * resources to one target. Calculation only: it never sends anything; each row only
 * offers a link to the game's own fleet page, and the player still presses Send.
 */
import type { AccountSnapshot, Resources } from '../data/account-info';
import type { BodyRow } from './account';

export const LARGE_CARGO = '203';
const LARGE_CARGO_BASE = 25_000;
const HYPERSPACE_TECH = '114';

/**
 * Large Cargo capacity: base × (1 + 5% per Hyperspace Technology level), +25% for the
 * Collector class. Lifeform bonuses are not known here, so the player can override it.
 */
export function largeCargoCapacity(snapshot: AccountSnapshot | null, characterClass: number | null): number {
  const hyper = snapshot?.researches[HYPERSPACE_TECH] ?? 0;
  const classBonus = characterClass === 1 ? 0.25 : 0;
  return Math.floor(LARGE_CARGO_BASE * (1 + 0.05 * hyper + classBonus));
}

export interface CollectRow {
  id: number;
  type: 'planet' | 'moon';
  name: string;
  coords: string;
  send: Resources;
  total: number;
  ships: number;
  available: number;
}

export interface CollectPlan {
  rows: CollectRow[];
  send: Resources;
  ships: number;
}

export function planCollection(
  rows: BodyRow[],
  snapshot: AccountSnapshot | null,
  targetId: number,
  pick: { metal: boolean; crystal: boolean; deuterium: boolean },
  capacity: number,
): CollectPlan {
  const levels = new Map((snapshot?.bodies ?? []).map((b) => [b.id, b.levels]));
  const out: CollectRow[] = [];
  const send = { metal: 0, crystal: 0, deuterium: 0 };
  let ships = 0;
  for (const r of rows) {
    if (r.id === targetId) continue;
    const s = {
      metal: pick.metal ? Math.floor(r.amount.metal) : 0,
      crystal: pick.crystal ? Math.floor(r.amount.crystal) : 0,
      deuterium: pick.deuterium ? Math.floor(r.amount.deuterium) : 0,
    };
    const total = s.metal + s.crystal + s.deuterium;
    if (total <= 0) continue;
    const need = capacity > 0 ? Math.ceil(total / capacity) : 0;
    out.push({ id: r.id, type: r.type, name: r.name, coords: r.coords, send: s, total, ships: need,
      available: levels.get(r.id)?.[LARGE_CARGO] ?? 0 });
    send.metal += s.metal;
    send.crystal += s.crystal;
    send.deuterium += s.deuterium;
    ships += need;
  }
  return { rows: out, send, ships };
}

/**
 * Link to the game's fleet page from the source body, with target and ships filled in
 * through the page's own URL parameters. The player checks it and presses Send.
 */
export function fleetLink(origin: string, sourceId: number, target: { coords: string; type: 'planet' | 'moon' }, ships: number): string {
  const [galaxy, system, position] = target.coords.split(':');
  const params = new URLSearchParams({
    page: 'ingame', component: 'fleetdispatch', cp: String(sourceId),
    galaxy: galaxy ?? '', system: system ?? '', position: position ?? '',
    type: target.type === 'moon' ? '3' : '1', mission: '3', [`am${LARGE_CARGO}`]: String(ships),
  });
  return `${origin}/game/index.php?${params.toString()}`;
}
