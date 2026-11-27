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
 * Country and universe as OGLight sends them to PTRE: the universe's language (meta "ogame-language")
 * and every digit of the host ("s269-it…" → 269), so test and special servers name the same universe.
 */
export function ptreUniverse(host: string, lang: string): { country: string; univers: string } | null {
  const univers = host.split('.')[0]!.replace(/\D/g, '');
  const country = lang.trim().toLowerCase() || ptreServer(host)?.country || '';
  return univers && /^[a-z]{2,}$/.test(country) ? { country, univers } : null;
}

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
  /** The universe's language (meta "ogame-language"), PTRE's "country". */
  lang: string;
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
  const server = ptreUniverse(deps.host, deps.lang);
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

/** PTRE's time frames for a player's activity, as OGLight offers them. */
export const PTRE_FRAMES = ['last24h', '2days', '3days', 'week', '2weeks', 'month'] as const;
export type PtreFrame = (typeof PTRE_FRAMES)[number];

export interface PtrePlayer {
  /** One slot of the day: its label, the activities seen in it, how well it was checked (0–100). */
  slots: { label: string; activity: number; checked: number }[];
  /** Most activities seen in one slot (PTRE's scale for the dots). */
  max: number;
  /** The team's best spy report on the player: when, its fleet points, the ships, PTRE's page for it. */
  best: { at: number; fleetPoints: number; link: string; ships: Record<string, number> } | null;
}

const json = <V>(v: unknown, fallback: V): V => {
  if (typeof v !== 'string') return (v ?? fallback) as V;
  try { return JSON.parse(v) as V; } catch { return fallback; }
};

/** PTRE's answer for one player (oglight_get_player_infos.php), read the way OGLight reads it. */
export function parsePtrePlayer(data: Record<string, unknown> | null): PtrePlayer | null {
  if (!data || String(data.code) !== '1') return null;
  const a = (data.activity_array ?? {}) as { succes?: unknown; activity_array?: unknown; check_array?: unknown; max_acti_per_slot?: unknown };
  const lines = String(a.succes) === '1' ? json<unknown[][]>(a.activity_array, []) : [];
  const checks = String(a.succes) === '1' ? json<unknown[][]>(a.check_array, []) : [];
  const slots = (Array.isArray(lines) ? lines : []).flatMap((line, i) => {
    const activity = Number(Array.isArray(line) ? line[1] : NaN);
    if (!Array.isArray(line) || !Number.isFinite(activity)) return [];
    const check = Number(Array.isArray(checks[i]) ? checks[i]![1] : 0);
    return [{ label: String(line[0] ?? ''), activity, checked: Number.isFinite(check) ? Math.max(0, Math.min(100, check)) : 0 }];
  });
  const at = Number(data.top_sr_timestamp) * 1000;
  const ships: Record<string, number> = {};
  for (const s of json<{ ship_type?: unknown; count?: unknown }[]>(data.fleet_json, [])) {
    const n = Number(s?.count);
    if (/^\d+$/.test(String(s?.ship_type ?? '')) && n > 0) ships[String(s.ship_type)] = n;
  }
  const link = String(data.top_sr_link ?? '');
  const best = at > 0 ? { at, fleetPoints: Number(data.top_sr_fleet_points) || 0, link: /^https:\/\/ptre\.chez\.gg\//.test(link) ? link : '', ships } : null;
  return { slots, max: Number(a.max_acti_per_slot) || 0, best };
}

/** One player's activity and best report in the team's PTRE, for the frame the player picked. */
export async function ptrePlayerInfo(deps: PtreDeps, player: { id: number; name: string }, frame: PtreFrame): Promise<{ info: PtrePlayer | null; message: string }> {
  const r = await ptreCall(deps, 'oglight_get_player_infos.php', { player_id: String(player.id), pseudo: player.name, input_frame: frame });
  return { info: r.ok ? parsePtrePlayer(r.data) : null, message: r.message };
}

/** The player's page on PTRE (a plain link, opened by the player). */
export function ptreProfileUrl(host: string, lang: string, playerId: number): string | null {
  const u = ptreUniverse(host, lang);
  return u ? `https://ptre.chez.gg/?country=${u.country}&univers=${u.univers}&player_id=${playerId}` : null;
}

/** PTRE's page where the team manages its target list (a plain link). */
export const PTRE_TARGETS_PAGE = 'https://ptre.chez.gg/?page=players_list';

/**
 * Syncs the team's target list, as OGLight's «Sync with PTRE»: sends the players flagged PTRE, gets the
 * team's whole list back. The body is a JSON string with no Content-Type, as OGLight sends it.
 */
export async function ptreSyncTargets(deps: PtreDeps, targets: { id: number; pseudo: string }[]): Promise<PtreAnswer & { targets: { id: number; name: string }[] }> {
  const r = await ptreCall(deps, 'api_sync_target_list.php', {}, { method: 'POST', body: JSON.stringify(targets) });
  const list = Array.isArray(r.data?.targets_array) ? (r.data.targets_array as { player_id?: unknown; pseudo?: unknown }[]) : [];
  const back = r.ok ? list.flatMap((p) => (/^\d+$/.test(String(p?.player_id ?? '')) ? [{ id: Number(p.player_id), name: String(p.pseudo ?? '') }] : [])) : [];
  return { ok: r.ok, message: String(r.data?.message || r.message || ''), targets: back };
}
