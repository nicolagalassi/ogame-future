import type { AccountSnapshot, OwnBody, Resources } from '../data/account-info';

const KEYS = ['metal', 'crystal', 'deuterium'] as const;

/**
 * Estimates what a body holds now from the last known amount plus production.
 * Production is assumed per second; moons produce nothing. A known storage caps the
 * result, but never below what was already there (resources can exceed storage).
 */
export function estimateResources(body: OwnBody, now: number): Resources {
  const seconds = Math.max(0, (now - body.resourcesAt) / 1000);
  const out = { metal: 0, crystal: 0, deuterium: 0 };
  for (const key of KEYS) {
    const start = body.resources[key];
    const grown = body.type === 'planet' ? start + body.production[key] * seconds : start;
    const cap = body.storage[key];
    out[key] = cap > 0 ? Math.max(start, Math.min(grown, cap)) : grown;
  }
  return out;
}

/** Share of storage in use, 0..1, or null when storage is unknown. */
export function storageFill(body: OwnBody, amount: Resources): Resources | null {
  if (KEYS.every((k) => body.storage[k] <= 0)) return null;
  const fill = (k: (typeof KEYS)[number]) => (body.storage[k] > 0 ? Math.min(1, amount[k] / body.storage[k]) : 0);
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

export function totals(snapshot: AccountSnapshot, now: number): { stock: Resources; perHour: Resources } {
  const stock = { metal: 0, crystal: 0, deuterium: 0 };
  const perHour = { metal: 0, crystal: 0, deuterium: 0 };
  for (const body of snapshot.bodies) {
    const r = estimateResources(body, now);
    for (const k of KEYS) {
      stock[k] += r[k];
      if (body.type === 'planet') perHour[k] += body.production[k] * 3600;
    }
  }
  return { stock, perHour };
}
