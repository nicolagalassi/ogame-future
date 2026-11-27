/**
 * PTRE's ranking snapshot (https://ptre.chez.gg): every player's total points at PTRE's last
 * reading, used for the points difference on the highscore page, as OGLight does.
 *
 * COMPLIANCE (AGENTS.md §1.9, §6, Nicola's rule "what OGLight already does is allowed"): read only
 * while the player has the highscore page open (reason 'user-view'), at most every 6 hours, without
 * cookies. Only the country and the universe number are sent, plus the tool name; no team key and
 * nothing about the player.
 */
import { PTRE_BASE, PTRE_RANKS, type NetworkGuard } from '../core/guard';
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

/* ---------- The team's PTRE: everything below needs the player's team key ---------- */

/**
 * The player's PTRE team key, per universe and player (a team lives on one universe). It works as a
 * password for the team's data: never in a backup file (core/backup), never in the network log (guard).
 */
export const TEAM_KEY = 'ptre.teamKey';
/** PTRE's last answers that were not a success, newest last (shown in Settings › PTRE). */
export const ERRORS_KEY = 'ptre.errors';
const ERRORS_MAX = 10;

/** "TM-XXXX-XXXX-XXXX-XXXX": 18 characters without the dashes, starting with TM (as PTRE checks it). */
export function normalTeamKey(text: string): string | null {
  const tk = text.trim().toUpperCase();
  return /^TM[A-Z0-9]{16}$/.test(tk.replace(/-/g, '')) ? tk : null;
}

export const teamKeyOf = (store: Store): string | null => normalTeamKey(store.get<string>(TEAM_KEY, ''));

export interface PtreDeps {
  guard: NetworkGuard;
  store: Store;
  /** The game's host, e.g. "s269-it.ogame.gameforge.com". */
  host: string;
  /** Future's version, sent as OGLight sends its own. */
  version: string;
  now?: () => number;
}

export interface PtreAnswer {
  ok: boolean;
  /** PTRE's message, or why Future did not ask. */
  message: string;
}

export interface PtreError {
  at: number;
  code: string;
  message: string;
}

/**
 * One call of the team's PTRE: the parameters OGLight sends (tool, team key, country, universe,
 * version), tool = "future". Without a team key nothing is sent. A failure is kept for the errors list.
 * COMPLIANCE (AGENTS.md §1.9, §4): only from a click of the player ('user-sync'); the guard refuses
 * any other script and masks the key in its log.
 */
export async function ptreCall(deps: PtreDeps, script: string, params: Record<string, string>, init: RequestInit = {}): Promise<PtreAnswer & { data: Record<string, unknown> | null }> {
  const key = teamKeyOf(deps.store);
  const server = ptreServer(deps.host);
  if (!key || !server) return { ok: false, message: key ? 'server' : 'no-key', data: null };
  const query = new URLSearchParams({ ...params, tool: 'future', team_key: key, country: server.country, univers: server.univers, version: deps.version });
  let data: Record<string, unknown> | null = null;
  try {
    const res = await deps.guard.request(`${PTRE_BASE}${script}?${query}`, 'user-sync', init);
    data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  } catch (e) {
    data = { code: 'net', message: e instanceof Error ? e.message : String(e) };
  }
  const code = String(data?.code ?? '?');
  const message = String(data?.message_verbose || data?.message || '');
  const ok = code === '1';
  if (!ok) {
    const errors = deps.store.get<PtreError[]>(ERRORS_KEY, []);
    deps.store.set(ERRORS_KEY, [...errors, { at: deps.now?.() ?? Date.now(), code, message }].slice(-ERRORS_MAX));
  }
  return { ok, message, data };
}

/** Saves one spy report to the team's PTRE by its API id ("sr-…"), as OGLight's button does. */
export async function ptreSaveSpyReport(deps: PtreDeps, apiKey: string): Promise<PtreAnswer> {
  const { ok, message } = await ptreCall(deps, 'oglight_import.php', { sr_id: apiKey }, { method: 'POST' });
  return { ok, message };
}
