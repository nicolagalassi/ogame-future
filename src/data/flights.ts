/**
 * Resources travelling in the player's own fleets (transports, deployments, expeditions, collections…),
 * read from the game's event list (#eventContent) when the game shows it. The game loads that list
 * itself when the player opens it: Future only reads the rows already on the page (no network call,
 * no timer). Each row's fleet tooltip holds the ships and, after them, the cargo (metal, crystal,
 * deuterium, food), the same table OGLight reads; labels are not needed, only the order.
 */
import type { Resources } from './account-info';

export const FLIGHTS_KEY = 'fleet.inFlight';

export interface Flight {
  /** Same fleet in its outbound and return rows: mission, the two coordinates, the ships. */
  key: string;
  cargo: Resources;
  /** Local time (ms) when the cargo stops travelling: delivery for transport / deploy, otherwise the return. */
  until: number;
}

export interface Flights {
  readAt: number;
  list: Flight[];
}

const ZERO: Resources = { metal: 0, crystal: 0, deuterium: 0 };
const num = (text: string | null | undefined) => Number((text ?? '').replace(/\D/g, '')) || 0;

/** Ships and cargo from a fleet tooltip: values grouped under each header (ships first, cargo last). */
export function parseFleetTooltip(html: string, doc: Document): { ships: string; cargo: Resources } {
  const box = doc.createElement('template');
  box.innerHTML = html;
  const sections: { label: string; value: number }[][] = [];
  for (const tr of box.content.querySelectorAll('tr')) {
    if (tr.querySelector('th')) {
      sections.push([]);
      continue;
    }
    const value = tr.querySelector('td.value');
    if (!value) continue;
    if (!sections.length) sections.push([]);
    sections[sections.length - 1]!.push({ label: (tr.querySelector('td')?.textContent ?? '').trim(), value: num(value.textContent) });
  }
  const filled = sections.filter((s) => s.length);
  const cargoPart = filled.length > 1 ? filled[filled.length - 1]! : [];
  const shipPart = filled[0] ?? [];
  return {
    ships: shipPart.map((s) => `${s.label}${s.value}`).join(','),
    cargo: cargoPart.length >= 3 ? { metal: cargoPart[0]!.value, crystal: cargoPart[1]!.value, deuterium: cargoPart[2]!.value } : { ...ZERO },
  };
}

/**
 * The player's own fleets in the event list, one per fleet (outbound and return rows merged), or
 * null when the list is not on the page. `offset` = server clock − local clock, in ms.
 */
export function readEventFlights(doc: Document, offset: number): Flight[] | null {
  const table = doc.getElementById('eventContent');
  // No rows at all: the game has not filled the list yet (it loads it on demand).
  if (!table || !table.querySelector('tr')) return null;
  const groups = new Map<string, { mission: number; cargo: Resources; outbound: number; latest: number }>();
  for (const row of table.querySelectorAll<HTMLElement>('tr.eventFleet')) {
    // Own fleets only: the game marks their countdown "friendly" (others' are hostile / neutral).
    if (!row.querySelector('td.countDown.friendly, td.countDown .friendly')) continue;
    const arrival = Number(row.dataset.arrivalTime) * 1000 - offset;
    if (!(arrival > 0)) continue;
    const mission = Number(row.dataset.missionType) || 0;
    const back = row.dataset.returnFlight === 'true';
    const tip = row.querySelector<HTMLElement>('td.icon_movement .tooltip, td.icon_movement_reserve .tooltip, td.icon_movement [data-tooltip-title], td.icon_movement_reserve [data-tooltip-title]');
    const html = tip?.getAttribute('data-tooltip-title') ?? tip?.getAttribute('title') ?? '';
    const { ships, cargo } = parseFleetTooltip(html, doc);
    const coords = [row.querySelector('td.coordsOrigin')?.textContent, row.querySelector('td.destCoords')?.textContent].map((c) => (c ?? '').replace(/\s+/g, ''));
    const key = `${mission}|${coords.sort().join('>')}|${ships}`;
    const g = groups.get(key) ?? { mission, cargo: { ...ZERO }, outbound: 0, latest: 0 };
    g.cargo = { metal: Math.max(g.cargo.metal, cargo.metal), crystal: Math.max(g.cargo.crystal, cargo.crystal), deuterium: Math.max(g.cargo.deuterium, cargo.deuterium) };
    if (!back) g.outbound = Math.max(g.outbound, arrival);
    g.latest = Math.max(g.latest, arrival);
    groups.set(key, g);
  }
  return [...groups].map(([key, g]) => ({
    key,
    cargo: g.cargo,
    // Transport and deploy leave the cargo at the destination; the others bring it back home.
    until: (g.mission === 3 || g.mission === 4) && g.outbound ? g.outbound : g.latest,
  }));
}

/** What is still travelling at `now`. */
export function flyingTotal(flights: Flights | null, now: number): Resources {
  const out = { ...ZERO };
  for (const f of flights?.list ?? []) {
    if (f.until <= now) continue;
    out.metal += f.cargo.metal;
    out.crystal += f.cargo.crystal;
    out.deuterium += f.cargo.deuterium;
  }
  return out;
}

/**
 * Reads the event list now and whenever the game redraws it, and calls `onRead` when the fleets
 * changed. Reacts to the page only: the observer reads the DOM, it never calls the server.
 */
export function watchFlights(doc: Document, offset: number, onRead: (list: Flight[]) => void): void {
  let last = '';
  const read = () => {
    const list = readEventFlights(doc, offset);
    if (!list) return;
    const sig = JSON.stringify(list);
    if (sig === last) return;
    last = sig;
    onRead(list);
  };
  read();
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    setTimeout(() => {
      queued = false;
      read();
    }, 100);
  }).observe(doc.body, { childList: true, subtree: true });
}
