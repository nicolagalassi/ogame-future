/**
 * Reads the account snapshot from OGame's externaldataexport endpoint.
 *
 * COMPLIANCE (AGENTS.md §4.1): accountInfo is heavy and refreshes the highscore
 * for every planet at once. Future reads it ONCE per browser-tab session, at the
 * first game page, and keeps itself current afterwards by reading the pages the
 * player opens. A fresh read later happens only through the Sync button.
 */
import type { CallReason, NetworkGuard } from '../core/guard';
import type { Store } from '../core/storage';

export const ACCOUNT_INFO_PATH =
  '/game/index.php?page=componentOnly&component=externaldataexport&action=accountInfo&asJson=1';

export interface Production {
  metal: number;
  crystal: number;
  deuterium: number;
}

export interface Resources {
  metal: number;
  crystal: number;
  deuterium: number;
}

export interface OwnBody {
  id: number;
  type: 'planet' | 'moon';
  name: string;
  coords: string;
  /** For a planet: its moon's id. For a moon: its planet's id. */
  siblingId: number | null;
  /** Per hour, as in OGLight (daily = ×24). Verified in game on 2026-11-05. */
  production: Production;
  resources: Resources;
  /** Storage capacity when the snapshot gives it, else 0 (= unknown, no cap). */
  storage: Resources;
  /** When `resources` was last read (accountInfo or the game's resource bar). */
  resourcesAt: number;
  levels: Record<string, number>;
}

export interface AccountSnapshot {
  fetchedAt: number;
  bodies: OwnBody[];
  researches: Record<string, number>;
}

type RawBody = Record<string, unknown>;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const record = (v: unknown): Record<string, number> => {
  if (!v || typeof v !== 'object') return {};
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, num(x)]));
};

function toBody(raw: RawBody, type: OwnBody['type'], fetchedAt: number): OwnBody {
  const prod = (raw.production ?? {}) as Record<string, unknown>;
  const res = (raw.resources ?? {}) as Record<string, unknown>;
  return {
    id: num(raw.id),
    type,
    name: typeof raw.name === 'string' ? raw.name : '',
    coords: `${num(raw.galaxy)}:${num(raw.system)}:${num(raw.position)}`,
    siblingId: raw.siblingId == null ? null : num(raw.siblingId),
    production: { metal: num(prod.metal), crystal: num(prod.crystal), deuterium: num(prod.deuterium) },
    resources: { metal: num(res.metal), crystal: num(res.crystal), deuterium: num(res.deuterium) },
    storage: { metal: num(res.metalStorage), crystal: num(res.crystalStorage), deuterium: num(res.deuteriumStorage) },
    resourcesAt: fetchedAt,
    levels: {
      ...record(raw.buildings),
      ...record(raw.ships),
      ...record(raw.defenses),
      ...record(raw.speciesBuildings),
      ...record(raw.speciesResearches),
    },
  };
}

/** Turns the raw JSON into Future's own shape. Unknown or missing fields become 0, never NaN. */
export function parseAccountInfo(json: unknown, fetchedAt: number): AccountSnapshot {
  const data = (json ?? {}) as Record<string, unknown>;
  const list = (v: unknown): RawBody[] =>
    Array.isArray(v) ? (v as RawBody[]) : v && typeof v === 'object' ? Object.values(v as Record<string, RawBody>) : [];
  return {
    fetchedAt,
    bodies: [
      ...list(data.planets).map((b) => toBody(b, 'planet', fetchedAt)),
      ...list(data.moons).map((b) => toBody(b, 'moon', fetchedAt)),
    ],
    researches: record(data.researches),
  };
}

export interface HydrateDeps {
  guard: NetworkGuard;
  store: Store;
  /** Per-tab session storage (window.sessionStorage in the game). */
  session: Pick<Storage, 'getItem' | 'setItem'>;
  now?: () => number;
}

export const SNAPSHOT_KEY = 'account.snapshot';
const sessionKey = (store: Store) => `${store.namespace}:account.hydrated`;

export async function fetchAccount(deps: HydrateDeps, reason: CallReason): Promise<AccountSnapshot> {
  const now = deps.now ?? (() => Date.now());
  const response = await deps.guard.request(ACCOUNT_INFO_PATH, reason);
  const snapshot = parseAccountInfo(await response.json(), now());
  deps.store.set(SNAPSHOT_KEY, snapshot);
  deps.session.setItem(sessionKey(deps.store), '1');
  return snapshot;
}

/** Returns the stored snapshot, reading accountInfo only on the first page of the session. */
export async function hydrateAccountOncePerSession(deps: HydrateDeps): Promise<AccountSnapshot | null> {
  const stored = deps.store.get<AccountSnapshot | null>(SNAPSHOT_KEY, null);
  if (stored && deps.session.getItem(sessionKey(deps.store)) === '1') return stored;
  return fetchAccount(deps, 'page-load');
}

/** For the Sync button only: must be called from a real click handler. */
export function syncAccountOnUserClick(deps: HydrateDeps): Promise<AccountSnapshot> {
  return fetchAccount(deps, 'user-sync');
}
