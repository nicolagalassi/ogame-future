/**
 * "Ripeti": after the player sends a fleet prepared by a Future button, open the next
 * planet or moon with the same button already applied, until the round is complete.
 *
 * Precedent: OGLight does the same (its collect / expedition / fleetsave modes redirect to
 * the next planet after a successful send, carrying the mode in the URL). Nicola decided
 * to follow OGLight's precedent here. Like OGLight:
 * - the trigger is the player's own "Invia flotta" (one click = one send);
 * - the next page only gets the form prepared, sending is again the player's click;
 * - the page change is a normal navigation with cp, the same as clicking the planet list.
 * GRAY AREA per AGENTS.md §1.5 if read strictly: mention it when asking ToolDev toleration.
 */
import { nextBody, type BodyRef } from '../../engines/fleet';
import type { FleetMode } from './actions';

const PENDING_KEY = 'fut.fleet.repeatPending';
/** A send must land within this time for the redirect to count as the follow-up of the send. */
const PENDING_MAX_AGE_MS = 60_000;

export interface RepeatState {
  mode: FleetMode;
  /** First body of the round: the round ends when we would come back to it. */
  first: number;
  /** Destination of transport/deploy, kept across the round. */
  dest: number | null;
}

interface Pending extends RepeatState {
  from: number;
  fleetCount: number;
  at: number;
}

/** Reads ?futmode=…&futfirst=…&futdest=… from the URL. */
export function readRepeatParams(url: string): RepeatState | null {
  const p = new URL(url).searchParams;
  const mode = p.get('futmode') as FleetMode | null;
  const first = Number(p.get('futfirst'));
  if (!mode || !Number.isFinite(first) || first <= 0) return null;
  const dest = Number(p.get('futdest'));
  return { mode, first, dest: Number.isFinite(dest) && dest > 0 ? dest : null };
}

export function repeatUrl(base: string, cp: number, state: RepeatState): string {
  const u = new URL(base);
  u.search = '';
  u.searchParams.set('page', 'ingame');
  u.searchParams.set('component', 'fleetdispatch');
  u.searchParams.set('cp', String(cp));
  u.searchParams.set('futmode', state.mode);
  u.searchParams.set('futfirst', String(state.first));
  if (state.dest) u.searchParams.set('futdest', String(state.dest));
  return u.toString();
}

/** Remembers, at the moment of the player's send, what to do once the game confirms it. */
export function armRepeat(state: RepeatState, from: number, fleetCount: number, now = Date.now()): void {
  const pending: Pending = { ...state, from, fleetCount, at: now };
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    /* no session storage: repeat simply does not happen */
  }
}

export function disarmRepeat(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export type RepeatDecision =
  | { kind: 'none' }
  | { kind: 'next'; cp: number; state: RepeatState }
  | { kind: 'done' };

/**
 * On a fleet page load: was the last send from a Future button successful (one more fleet
 * in flight than before, on the same body)? Then say where to go next.
 */
export function decideRepeat(o: { bodyId: number; fleetCount: number; list: BodyRef[]; now?: number }): RepeatDecision {
  let pending: Pending | null = null;
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    pending = raw ? (JSON.parse(raw) as Pending) : null;
  } catch {
    pending = null;
  }
  if (!pending) return { kind: 'none' };
  disarmRepeat();
  const now = o.now ?? Date.now();
  if (now - pending.at > PENDING_MAX_AGE_MS || pending.from !== o.bodyId || o.fleetCount <= pending.fleetCount) return { kind: 'none' };
  const next = nextBody(o.list, o.bodyId, {
    skip: pending.mode === 'transport' || pending.mode === 'deploy' ? pending.dest : null,
    onlyWithMoon: pending.mode === 'moon',
  });
  if (next === null || next === pending.first) return { kind: 'done' };
  return { kind: 'next', cp: next, state: { mode: pending.mode, first: pending.first, dest: pending.dest } };
}
