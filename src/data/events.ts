/**
 * The game's event list (fleets in flight), read per planet and moon: which bodies are under attack or
 * being spied on, and which of the player's own fleets are leaving from or coming back to each body.
 *
 * Source: the same table the game shows (#eventContent), either already on the page (the player opened
 * the list) or read once while the page loads, as OGLight does for its fleet movements.
 *
 * COMPLIANCE (AGENTS.md §1.3, §1.4, §4):
 * - At most one background call per page load, through the guard with reason 'page-load', never on a
 *   timer: an attack shows up when the player loads a page, never by itself (Nicola, 2026-11-26).
 *   Skipped when the last reading is under 10 s old (OGLight's own interval).
 * - Nothing is sent anywhere and no alarm fires: the planet menu only paints what the game already lists.
 */
import type { CallReason, NetworkGuard } from '../core/guard';
import type { Store } from '../core/storage';

export const EVENTS_KEY = 'fleet.events';
export const EVENT_LIST_PATH = '/game/index.php?page=componentOnly&component=eventList&ajax=1';
export const EVENTS_MIN_INTERVAL_MS = 10_000;

/** OGame mission codes that come at the player: attack, ACS attack, espionage, moon destruction. */
export const HOSTILE_MISSIONS = [1, 2, 6, 9] as const;

export interface EventPlace {
  coords: string;
  /** Where on that position: planet, moon or debris field. */
  type: 'planet' | 'moon' | 'debris';
}

export interface FleetEvent {
  mission: number;
  /** The game's colour of the row: the player's own fleet, an enemy's, or another player's peaceful one. */
  side: 'own' | 'hostile' | 'neutral';
  back: boolean;
  /** Local time (ms) the row's fleet arrives. */
  arrival: number;
  from: EventPlace;
  to: EventPlace;
  /** Ships in the fleet, as the row's number says. */
  ships: number;
}

export interface Events {
  readAt: number;
  list: FleetEvent[];
}

const coordsOf = (text: string | null | undefined) => (text ?? '').replace(/[^\d:]/g, '');

function placeOf(cell: Element | null, coords: Element | null): EventPlace {
  const fig = cell?.querySelector('figure');
  const type = fig?.classList.contains('moon') ? 'moon' : fig?.classList.contains('tf') ? 'debris' : 'planet';
  return { coords: coordsOf(coords?.textContent), type };
}

/**
 * The fleet rows of an event table (the page's or the one read at load). Rows of an ACS partner
 * (class partnerInfo) repeat their group's row and are left out. `offset` = server − local clock, ms.
 */
export function parseEventRows(root: ParentNode, offset: number): FleetEvent[] {
  const out: FleetEvent[] = [];
  for (const row of root.querySelectorAll<HTMLElement>('#eventContent tr.eventFleet, #eventContent tr.allianceAttack')) {
    if (row.classList.contains('partnerInfo')) continue;
    const arrival = Number(row.dataset.arrivalTime) * 1000 - offset;
    if (!(arrival > 0)) continue;
    const mark = row.querySelector('td.countDown');
    const tone = mark?.querySelector('.hostile, .friendly, .neutral') ?? mark;
    const side = tone?.classList.contains('hostile') ? 'hostile' : tone?.classList.contains('friendly') ? 'own' : 'neutral';
    out.push({
      mission: Number(row.dataset.missionType) || 0,
      side,
      back: row.dataset.returnFlight === 'true',
      arrival,
      from: placeOf(row.querySelector('td.originFleet'), row.querySelector('td.coordsOrigin')),
      to: placeOf(row.querySelector('td.destFleet'), row.querySelector('td.destCoords')),
      ships: Number((row.querySelector('td.detailsFleet')?.textContent ?? '').replace(/\D/g, '')) || 0,
    });
  }
  return out;
}

/** The event table already on the page, or null when the game has not filled it. */
export function readPageEvents(doc: Document, offset: number): FleetEvent[] | null {
  const table = doc.getElementById('eventContent');
  if (!table || !table.querySelector('tr')) return null;
  return parseEventRows(doc, offset);
}

export interface EventDeps {
  guard: NetworkGuard;
  store: Store;
  doc: Document;
  offset: number;
  now?: () => number;
}

async function fetchEvents(deps: EventDeps, reason: CallReason): Promise<Events> {
  const now = (deps.now ?? (() => Date.now()))();
  const response = await deps.guard.request(EVENT_LIST_PATH, reason);
  const box = deps.doc.createElement('template');
  box.innerHTML = await response.text();
  const events = { readAt: now, list: parseEventRows(box.content, deps.offset) };
  deps.store.set(EVENTS_KEY, events);
  return events;
}

/** Page load only: the page's own table when it is there, else the stored list or one fresh reading. */
export async function loadEventsOnPageLoad(deps: EventDeps): Promise<Events> {
  const now = (deps.now ?? (() => Date.now()))();
  const onPage = readPageEvents(deps.doc, deps.offset);
  if (onPage) {
    const events = { readAt: now, list: onPage };
    deps.store.set(EVENTS_KEY, events);
    return events;
  }
  const stored = deps.store.get<Events | null>(EVENTS_KEY, null);
  if (stored && now - stored.readAt < EVENTS_MIN_INTERVAL_MS) return stored;
  return fetchEvents(deps, 'page-load');
}

/** For the Sync button only. */
export function syncEventsOnUserClick(deps: EventDeps): Promise<Events> {
  return fetchEvents(deps, 'user-sync');
}

/** What one own fleet is doing as seen from a body: leaving it, coming back to it, or arriving at it. */
export type Way = 'out' | 'back' | 'in';

export interface BodyEvents {
  /** Earliest enemy attack and espionage still to land here (local ms), if any. */
  attack: number | null;
  spy: number | null;
  /** Own fleets, one entry per mission and way, with how many fleets and the first to land. */
  own: { mission: number; way: Way; count: number; first: number }[];
}

export const placeKey = (p: EventPlace) => `${p.coords}|${p.type === 'moon' ? 'm' : 'p'}`;

/**
 * Per body (key `coords|p` or `coords|m`): the enemy fleets landing there and the player's own fleets
 * tied to it. An own fleet counts once: on its way out, on the body it left; on its way back, on that
 * same body; a transport or deploy to another own body is also "in" arriving there.
 */
export function eventsByBody(list: FleetEvent[], now: number, own: Set<string>): Map<string, BodyEvents> {
  const out = new Map<string, BodyEvents>();
  const at = (key: string) => {
    let b = out.get(key);
    if (!b) out.set(key, (b = { attack: null, spy: null, own: [] }));
    return b;
  };
  const earliest = (a: number | null, b: number) => (a === null || b < a ? b : a);
  // The same fleet has an outbound and a return row: group them and count fleets, not rows.
  const groups = new Map<string, { mission: number; from: string; to: string; out: number[]; back: number[] }>();
  for (const e of list) {
    if (e.arrival <= now) continue;
    if (e.side === 'hostile') {
      if (e.back || e.to.type === 'debris') continue;
      const key = placeKey(e.to);
      if (!own.has(key)) continue;
      const b = at(key);
      if (e.mission === 6) b.spy = earliest(b.spy, e.arrival);
      else if ((HOSTILE_MISSIONS as readonly number[]).includes(e.mission)) b.attack = earliest(b.attack, e.arrival);
      continue;
    }
    if (e.side !== 'own') continue;
    const from = placeKey(e.from);
    const to = e.to.type === 'debris' ? `${e.to.coords}|d` : placeKey(e.to);
    const key = `${e.mission}|${from}|${to}|${e.ships}`;
    const g = groups.get(key) ?? { mission: e.mission, from, to, out: [], back: [] };
    (e.back ? g.back : g.out).push(e.arrival);
    groups.set(key, g);
  }
  const add = (key: string, mission: number, way: Way, count: number, first: number) => {
    if (!count || !own.has(key)) return;
    const entries = at(key).own;
    const same = entries.find((x) => x.mission === mission && x.way === way);
    if (same) {
      same.count += count;
      same.first = Math.min(same.first, first);
    } else entries.push({ mission, way, count, first });
  };
  for (const g of groups.values()) {
    const going = g.out.length;
    // A return row whose outbound row is still listed is the same fleet: it is still going.
    const coming = Math.max(0, g.back.length - going);
    if (going) {
      add(g.from, g.mission, 'out', going, Math.min(...g.out));
      // Delivering to another own body: it arrives there too.
      if ((g.mission === 3 || g.mission === 4) && g.to !== g.from) add(g.to, g.mission, 'in', going, Math.min(...g.out));
    }
    // The fleets already on their way back are the ones that left first: theirs are the earliest returns.
    if (coming) add(g.from, g.mission, 'back', coming, Math.min(...g.back));
  }
  return out;
}

/**
 * Follows the event table the game shows when the player opens it, and calls `onRead` when its fleets
 * changed. Reacts to the page only: the observer reads the DOM, it never calls the server.
 */
export function watchPageEvents(doc: Document, offset: number, onRead: (list: FleetEvent[]) => void): void {
  let last = '';
  const read = () => {
    const list = readPageEvents(doc, offset);
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
