/**
 * Reads the game's fleet dispatch page (component=fleetdispatch). Pure DOM reads.
 * The page keeps ship counts in #fleet1 #technologies li[data-technology] and the
 * target form in #fleet2.
 */
import type { Resources } from './account-info';

export function isFleetDispatch(doc: Document): boolean {
  return doc.getElementById('fleetdispatchcomponent') !== null && doc.getElementById('fleet1') !== null;
}

export interface ShipSlot {
  id: string;
  name: string;
  available: number;
  input: HTMLInputElement;
}

export function readShipSlots(doc: Document): ShipSlot[] {
  return Array.from(doc.querySelectorAll<HTMLElement>('#fleet1 #technologies li[data-technology]')).flatMap((li) => {
    const input = li.querySelector<HTMLInputElement>('input');
    if (!input) return [];
    const amount = li.querySelector<HTMLElement>('.amount');
    const available = Number(amount?.dataset.value ?? 0) || 0;
    return [{ id: li.dataset.technology ?? '', name: li.getAttribute('aria-label') ?? '', available, input }];
  });
}

export function originCoords(doc: Document): { galaxy: number; system: number; position: number } | null {
  const raw = doc.querySelector('meta[name="ogame-planet-coordinates"]')?.getAttribute('content');
  const parts = raw?.split(':').map(Number);
  if (!parts || parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  return { galaxy: parts[0]!, system: parts[1]!, position: parts[2]! };
}

/** Fuel shown by the game for the current selection (#consumption), 0 if not readable. */
export function readFuel(doc: Document): number {
  const text = doc.getElementById('consumption')?.textContent ?? '';
  const first = text.trim().split(/\s/)[0] ?? '';
  return Number(first.replace(/[^\d]/g, '')) || 0;
}

export function readAvailableResources(doc: Document): Resources {
  const raw = (id: string) => Number(doc.getElementById(id)?.getAttribute('data-raw') ?? 0) || 0;
  return { metal: raw('resources_metal'), crystal: raw('resources_crystal'), deuterium: raw('resources_deuterium') };
}

export function isFleet2Visible(doc: Document): boolean {
  const el = doc.getElementById('fleet2');
  return !!el && el.style.display !== 'none';
}
