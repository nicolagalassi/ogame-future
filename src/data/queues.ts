/**
 * Production queues per planet/moon (buildings, research, shipyard, lifeform), read from
 * the game's productionqueue component, the same source tolerated OGLight uses.
 *
 * COMPLIANCE: one background call per page load at most, through the guard with reason
 * 'page-load' and no cp parameter (AGENTS.md §4); never repeated on a timer. It is also
 * skipped when the last reading is under a minute old (OGLight waits 10 s).
 */
import type { NetworkGuard, CallReason } from '../core/guard';
import type { Store } from '../core/storage';

export type QueueKind = 'building' | 'research' | 'ship' | 'lfbuilding' | 'lfresearch';

export interface QueueItem {
  kind: QueueKind;
  name: string;
  /** Target level; for the shipyard (ships and defences) the amount ordered, as the game shows it. */
  level: number;
  /** End time, ms since epoch (server clock). */
  end: number;
}

export interface QueueSnapshot {
  at: number;
  bodies: Record<string, QueueItem[]>;
}

export const QUEUES_KEY = 'queues';
export const PRODUCTION_QUEUE_PATH = '/game/index.php?page=ajax&component=productionqueue&ajax=1';
export const QUEUE_MIN_INTERVAL_MS = 60_000;

/** Order used for stripes and tooltips. */
export const QUEUE_KINDS: QueueKind[] = ['building', 'lfbuilding', 'research', 'lfresearch', 'ship'];

const SELECTORS: [QueueKind, string][] = [
  ['building', 'building'],
  ['research', 'research'],
  ['ship', 'ship'],
  ['ship', 'ship_2nd'],
  ['lfbuilding', 'lifeformBuilding'],
  ['lfresearch', 'lifeformResearch'],
];

export function parseProductionQueue(html: string, ids: number[], now: number): QueueSnapshot {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const bodies: Record<string, QueueItem[]> = {};
  for (const id of ids) {
    const items: QueueItem[] = [];
    for (const [kind, cls] of SELECTORS) {
      const time = doc.querySelector(`time.${cls}${id}`);
      if (!time) continue;
      const details = time.closest('.productionDetails');
      const name = details?.querySelector('.productionName')?.childNodes[0]?.textContent?.trim() ?? '';
      const level = Number(details?.querySelector('.productionLevel')?.textContent?.replace(/\D/g, '') || 0);
      const end = Number(time.getAttribute('data-end')) * 1000;
      if (Number.isFinite(end) && end > 0) items.push({ kind, name, level, end });
    }
    bodies[String(id)] = items;
  }
  return { at: now, bodies };
}

/** Kinds still running at `now`, in display order. */
/** "Metal Mine → 31" or "42.171× Light Laser". */
export const queueLabel = (i: QueueItem, locale: string): string =>
  i.kind === 'ship' ? `${i.level ? `${i.level.toLocaleString(locale)}× ` : ''}${i.name}` : `${i.name}${i.level ? ` → ${i.level}` : ''}`;

export function activeItems(items: QueueItem[] | undefined, now: number): QueueItem[] {
  return (items ?? [])
    .filter((i) => i.end > now)
    .sort((a, b) => QUEUE_KINDS.indexOf(a.kind) - QUEUE_KINDS.indexOf(b.kind));
}

export interface QueueDeps {
  guard: NetworkGuard;
  store: Store;
  ids: number[];
  now?: () => number;
}

async function fetchQueues(deps: QueueDeps, reason: CallReason): Promise<QueueSnapshot> {
  const now = deps.now ?? (() => Date.now());
  const response = await deps.guard.request(PRODUCTION_QUEUE_PATH, reason);
  const snapshot = parseProductionQueue(await response.text(), deps.ids, now());
  deps.store.set(QUEUES_KEY, snapshot);
  return snapshot;
}

/** Page load only: returns the stored queues, reading them again when older than a minute. */
export async function loadQueuesOnPageLoad(deps: QueueDeps): Promise<QueueSnapshot | null> {
  const now = (deps.now ?? (() => Date.now()))();
  const stored = deps.store.get<QueueSnapshot | null>(QUEUES_KEY, null);
  if (stored && now - stored.at < QUEUE_MIN_INTERVAL_MS) return stored;
  return fetchQueues(deps, 'page-load');
}

/** For the Sync button only. */
export function syncQueuesOnUserClick(deps: QueueDeps): Promise<QueueSnapshot> {
  return fetchQueues(deps, 'user-sync');
}
