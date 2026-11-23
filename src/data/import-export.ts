/**
 * Is today's import/export offer still to be used? From the game's own `importExportInfo` answer
 * (OGame 13+), the way OGame Infinity reads it: `hasBought` / `gotItem` false = the offer is waiting.
 *
 * COMPLIANCE: one background call per session at most, at page load, through the guard, no `cp=`
 * (AGENTS.md §4, docs/API-NOTES.md: «come sopra», read once, never polled). Marked before the call, so a
 * failed read is not retried on every page; opening the Merchant's pages or Sync reads it again once.
 */
import type { CallReason, NetworkGuard } from '../core/guard';
import type { Store } from '../core/storage';

export const IMPORT_EXPORT_PATH = '/game/index.php?page=componentOnly&component=externaldataexport&action=importExportInfo&asJson=1';
export const IMPORT_EXPORT_KEY = 'importexport';

export interface ImportExportState {
  /** True while the day's offer can still be bought or taken. */
  available: boolean;
  at: number;
}

const isFalse = (v: unknown) => v === false || v === 'false' || v === 0 || v === '0';
const isTrue = (v: unknown) => v === true || v === 'true' || v === 1 || v === '1';

/** Available (true), used up (false), or null when the answer does not say (an error page, other fields). */
export function parseImportExport(json: unknown): boolean | null {
  if (!json || typeof json !== 'object') return null;
  const { hasBought, gotItem } = json as { hasBought?: unknown; gotItem?: unknown };
  if (hasBought === undefined && gotItem === undefined) return null;
  // Not bought yet, or bought and the item still to take: the offer is waiting.
  if (isFalse(hasBought) || isFalse(gotItem)) return true;
  if (isTrue(hasBought) && (gotItem === undefined || isTrue(gotItem))) return false;
  return null;
}

interface Deps {
  guard: NetworkGuard;
  store: Store;
  session: Pick<Storage, 'getItem' | 'setItem'>;
  now?: () => number;
}

const sessionKey = (store: Store) => `${store.namespace}:importexport.read`;

/** Reads the offer; an answer that says nothing leaves the stored state as it was. */
export async function fetchImportExport(deps: Omit<Deps, 'session'>, reason: CallReason): Promise<ImportExportState | null> {
  const response = await deps.guard.request(IMPORT_EXPORT_PATH, reason);
  let json: unknown = null;
  try {
    json = JSON.parse(await response.text());
  } catch {
    json = null;
  }
  const available = parseImportExport(json);
  if (available === null) return deps.store.get<ImportExportState | null>(IMPORT_EXPORT_KEY, null);
  const state = { available, at: (deps.now ?? Date.now)() };
  deps.store.set(IMPORT_EXPORT_KEY, state);
  return state;
}

/** The stored state, read from the game on the first page of the session (or after a visit to the Merchant). */
export async function importExportOncePerSession(deps: Deps): Promise<ImportExportState | null> {
  if (deps.session.getItem(sessionKey(deps.store)) === '1') return deps.store.get<ImportExportState | null>(IMPORT_EXPORT_KEY, null);
  deps.session.setItem(sessionKey(deps.store), '1');
  return fetchImportExport(deps, 'page-load');
}

/** On the Merchant's pages the player may buy or take the offer: the next page load reads it once more. */
export function forgetImportExportRead(store: Store, session: Pick<Storage, 'setItem'>): void {
  session.setItem(sessionKey(store), '0');
}
