import type { AccountSnapshot, OwnBody, Resources } from '../data/account-info';

const KEYS = ['metal', 'crystal', 'deuterium'] as const;

/**
 * Estimates what a body holds now from the last known amount plus production.
 * accountInfo production is per HOUR (OGLight shows it ×24 as daily; confirmed in game:
 * reading it per second made the numbers grow 3600 times too fast). Moons produce nothing. A known storage caps the
 * result, but never below what was already there (resources can exceed storage).
 */
export function estimateResources(body: OwnBody, now: number): Resources {
  const seconds = Math.max(0, (now - body.resourcesAt) / 1000);
  const out = { metal: 0, crystal: 0, deuterium: 0 };
  for (const key of KEYS) {
    const start = body.resources[key];
    const grown = body.type === 'planet' ? start + (body.production[key] * seconds) / 3600 : start;
    const cap = effectiveStorage(body)[key];
    out[key] = cap > 0 ? Math.max(start, Math.min(grown, cap)) : grown;
  }
  return out;
}

/** OGame storage formula: capacity of a metal/crystal/deuterium storage at a level. */
export function storageCapacity(level: number): number {
  return 5000 * Math.floor(2.5 * Math.exp((20 * level) / 33));
}

/** Storage building ids in OGame: 22 metal, 23 crystal, 24 deuterium. */
const STORAGE_BUILDING = { metal: '22', crystal: '23', deuterium: '24' } as const;

/**
 * Capacity per resource: the snapshot's own value when it has one, else computed
 * from the storage building level. 0 means unknown.
 */
export function effectiveStorage(body: OwnBody): Resources {
  const out = { metal: 0, crystal: 0, deuterium: 0 };
  for (const k of KEYS) {
    const level = body.levels[STORAGE_BUILDING[k]] ?? body.levels[`${k}Storage`];
    out[k] = body.storage[k] > 0 ? body.storage[k] : level !== undefined ? storageCapacity(level) : 0;
  }
  return out;
}

/** Share of storage in use, 0..1, or null when storage is unknown. */
export function storageFill(body: OwnBody, amount: Resources): Resources | null {
  const cap = effectiveStorage(body);
  if (KEYS.every((k) => cap[k] <= 0)) return null;
  const fill = (k: (typeof KEYS)[number]) => (cap[k] > 0 ? Math.min(1, amount[k] / cap[k]) : 0);
  return { metal: fill('metal'), crystal: fill('crystal'), deuterium: fill('deuterium') };
}

/** Updates the viewed body with the exact amounts the game shows on this page (no call). */
export function applyPageResources(snapshot: AccountSnapshot, bodyId: number, res: Resources, now: number): boolean {
  const body = snapshot.bodies.find((b) => b.id === bodyId);
  if (!body) return false;
  body.resources = { ...res };
  body.resourcesAt = now;
  return true;
}

/**
 * Copies into `target` every body amount of `source` that is newer, and returns `target`.
 * Saving merges into the stored snapshot instead of replacing it: another tab may have read
 * other bodies since this page loaded, and those newer amounts must survive.
 */
export function mergeNewerResources(target: AccountSnapshot, source: AccountSnapshot): AccountSnapshot {
  for (const body of source.bodies) {
    const into = target.bodies.find((b) => b.id === body.id);
    if (into && body.resourcesAt > into.resourcesAt) {
      into.resources = { ...body.resources };
      into.resourcesAt = body.resourcesAt;
    }
  }
  return target;
}

export function totals(snapshot: AccountSnapshot, now: number): { stock: Resources; perHour: Resources } {
  const stock = { metal: 0, crystal: 0, deuterium: 0 };
  const perHour = { metal: 0, crystal: 0, deuterium: 0 };
  for (const body of snapshot.bodies) {
    const r = estimateResources(body, now);
    for (const k of KEYS) {
      stock[k] += r[k];
      if (body.type === 'planet') perHour[k] += body.production[k];
    }
  }
  return { stock, perHour };
}
