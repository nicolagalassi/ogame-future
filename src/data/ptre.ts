/**
 * PTRE's ranking snapshot (https://ptre.chez.gg): every player's total points at PTRE's last
 * reading, used for the points difference on the highscore page, as OGLight does.
 *
 * COMPLIANCE (AGENTS.md §1.9, §6, Nicola's rule "what OGLight already does is allowed"): read only
 * while the player has the highscore page open (reason 'user-view'), at most every 6 hours, without
 * cookies. Only the country and the universe number are sent, plus the tool name; no team key and
 * nothing about the player.
 */
import { PTRE_RANKS, type NetworkGuard } from '../core/guard';
import type { Store } from '../core/storage';

export const PTRE_KEY = 'ptre.ranks';
/** Same pace as OGLight: PTRE takes its snapshot once a day. */
const TTL = 6 * 3_600_000;

export interface PtreRanks {
  /** When Future read it (ms). */
  readAt: number;
  /** PTRE's snapshot time (ms). */
  at: number;
  /** Total points per player id at the snapshot. */
  scores: Record<string, number>;
}

export function parsePtreRanks(json: unknown, readAt: number): PtreRanks | null {
  const d = (json ?? {}) as { code?: unknown; ranks_array?: { player_id?: unknown; timestamp?: unknown; total_score?: unknown }[] };
  if (Number(d.code) !== 1 || !Array.isArray(d.ranks_array) || !d.ranks_array.length) return null;
  const scores: Record<string, number> = {};
  for (const r of d.ranks_array) {
    const id = String(r.player_id ?? '');
    const score = Number(r.total_score);
    if (/^\d+$/.test(id) && Number.isFinite(score)) scores[id] = score;
  }
  const at = Number(d.ranks_array[0]?.timestamp) * 1000;
  return Object.keys(scores).length && Number.isFinite(at) ? { readAt, at, scores } : null;
}

/** "s269-it.ogame.gameforge.com" → country "it", universe "269". */
export function ptreServer(host: string): { country: string; univers: string } | null {
  const m = /^s(\d+)-([a-z]+)\./.exec(host);
  return m ? { univers: m[1]!, country: m[2]! } : null;
}

/** The stored snapshot, read again from PTRE when older than 6 hours. */
export async function ptreRanks(deps: { guard: NetworkGuard; store: Store; host: string; now?: number }): Promise<PtreRanks | null> {
  const now = deps.now ?? Date.now();
  const stored = deps.store.get<PtreRanks | null>(PTRE_KEY, null);
  if (stored && now - stored.readAt < TTL) return stored;
  const server = ptreServer(deps.host);
  if (!server) return stored;
  const query = new URLSearchParams({ country: server.country, univers: server.univers, timestamp: '-1', tool: 'future' });
  const res = await deps.guard.request(`${PTRE_RANKS}?${query}`, 'user-view');
  const fresh = res.ok ? parsePtreRanks(await res.json().catch(() => null), now) : null;
  if (!fresh) return stored;
  deps.store.set(PTRE_KEY, fresh);
  return fresh;
}
