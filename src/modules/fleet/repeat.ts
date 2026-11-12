/**
 * "Ripeti": after the player sends a fleet prepared by one of our buttons, open the next
 * planet or moon with the same button already applied, until the round is complete.
 *
 * Precedent: OGLight does the same. Its collect / expedition / fleetsave modes wrap the
 * game's send and, once the game confirms it, redirect to the next planet carrying the mode
 * in the URL. Nicola decided to follow OGLight's precedent here. As in OGLight:
 * - the trigger is the player's own "Invia flotta" (one click = one send);
 * - the next page only gets the form prepared, sending is again the player's click;
 * - the page change is a normal navigation with cp, the same as clicking the planet list.
 * GRAY AREA per AGENTS.md §1.5 if read strictly: mention it when asking ToolDev toleration.
 */
import { nextBody, type BodyRef } from '../../engines/fleet';
import { pageWindow, type FleetDispatcher } from '../../data/fleet-dispatcher';
import type { FleetMode } from './actions';

export interface RepeatState {
  mode: FleetMode;
  /** First body of the round: the round ends when we would come back to it. */
  first: number;
  /** Destination of transport/deploy, kept across the round. */
  dest: number | null;
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

/**
 * Where the round goes after `bodyId` (after a send, or when the player presses "Salta"): a body id,
 * or null when done. `skipIds` are the bodies the player marked to skip; the first body of the round
 * is never skipped, so the round still knows where it ends.
 */
export function nextInRound(state: RepeatState, bodyId: number, list: BodyRef[], skipIds: readonly number[] = []): number | null {
  const next = nextBody(list, bodyId, {
    skip: state.mode === 'collect' || state.mode === 'collectDeploy' || state.mode === 'plan' ? state.dest : null,
    skipIds: skipIds.filter((id) => id !== state.first),
    onlyWithMoon: state.mode === 'moon',
  });
  return next === null || next === state.first ? null : next;
}

type PostFn = (url: string, params: unknown, cb: (response: string) => void) => unknown;

/**
 * Wraps the game's own submitFleet2 (the function behind "Invia flotta" and Enter) so we
 * learn whether the game accepted the fleet, the same way OGLight does. The request itself
 * is the game's, unchanged. `onSent` returns true when it takes over the page change.
 */
export function hookSend(fd: FleetDispatcher & { submitFleet2?: (force?: boolean) => unknown; sendFleetUrl?: string }, onSent: () => boolean): void {
  const original = fd.submitFleet2;
  if (!original || (original as { futHooked?: boolean }).futHooked) return;
  const win = pageWindow() as unknown as { $?: { post: PostFn } };
  const wrapped = function (this: unknown, force?: boolean) {
    const $ = win.$;
    if (!$) return original.call(fd, force);
    const post = $.post;
    $.post = function (this: unknown, url: string, params: unknown, cb: (response: string) => void) {
      if (url !== fd.sendFleetUrl || typeof cb !== 'function') return post.call(this, url, params, cb);
      return post.call(this, url, params, function (this: unknown, response: string) {
        let ok = false;
        try {
          ok = (JSON.parse(response) as { success?: boolean }).success === true;
        } catch {
          ok = false;
        }
        if (ok && onSent()) return undefined;
        return cb.call(this, response);
      });
    };
    try {
      return original.call(fd, force);
    } finally {
      $.post = post;
    }
  };
  (wrapped as { futHooked?: boolean }).futHooked = true;
  fd.submitFleet2 = wrapped;
}
