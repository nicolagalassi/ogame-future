/**
 * Network guardian: the ONLY place in Future that may talk to a server.
 *
 * COMPLIANCE (AGENTS.md §1.3, §4, §4.2):
 * - Background calls may fire only while the page is loading. After bootstrap
 *   the window closes and any further 'page-load' call is refused.
 * - 'user-sync' calls are allowed later, but only from a handler bound to a
 *   real user click (e.g. the Sync button). Never call it from a timer.
 * - 'user-view' calls are allowed later too, but only to the universe's public API
 *   (/api/*.xml, no session, no cookies) and only from what the player points at
 *   (as OGLight does for player data in the galaxy view). The caller caches the answer.
 * - The one outside service is PTRE (https://ptre.chez.gg), never with cookies, and only on the
 *   scripts listed in `PTRE_SCRIPTS`, as OGLight uses them: its public ranking as 'user-view' from the
 *   highscore page the player opened; the team's own calls (they carry the player's team key) only once
 *   the player has typed a key, and only from a click ('user-sync', e.g. «Save to PTRE» on one report).
 *   The team key never reaches the log: it is masked there (AGENTS.md §1.9).
 * - The `cp` (change planet) parameter is refused on every game URL:
 *   it mutates the session's active planet.
 * - Every attempt, allowed or refused, is written to an in-memory log so the
 *   behaviour can be shown to a ToolDev during review.
 */

export type CallReason = 'page-load' | 'user-sync' | 'user-view';

/** PTRE's scripts: the only outside addresses Future may call. */
export const PTRE_BASE = 'https://ptre.chez.gg/scripts/';
/** PTRE's public ranking snapshot (no team key). */
export const PTRE_RANKS = `${PTRE_BASE}api_get_ranks.php`;
/**
 * Each PTRE script Future calls, and why (the same scripts OGLight calls, AGENTS.md exception in
 * docs/OGLIGHT-RULES.md). A script not listed here is refused.
 */
export const PTRE_SCRIPTS: Record<string, string> = {
  'api_get_ranks.php': "every player's points at PTRE's last reading (highscore page)",
  'oglight_import.php': 'one spy report the player chose to save to the team (its API id only)',
};

/** A URL as the log shows it: PTRE's team key masked. */
export function redactUrl(url: string): string {
  return url.replace(/([?&]team_?key=)[^&#]*/gi, '$1***');
}

export interface GuardLogEntry {
  at: number;
  url: string;
  reason: CallReason;
  allowed: boolean;
  why?: string;
}

export class GuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GuardError';
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class NetworkGuard {
  private pageLoadOpen = true;
  readonly log: GuardLogEntry[] = [];

  constructor(
    private readonly fetchImpl: FetchLike,
    private readonly gameOrigin: string,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Called once bootstrap is done: from here on only user-initiated calls pass. */
  closePageLoadWindow(): void {
    this.pageLoadOpen = false;
  }

  get isPageLoadOpen(): boolean {
    return this.pageLoadOpen;
  }

  async request(url: string, reason: CallReason, init: RequestInit = {}): Promise<Response> {
    const refusal = this.check(url, reason);
    this.log.push({ at: this.now(), url: redactUrl(url), reason, allowed: refusal === null, why: refusal ?? undefined });
    if (refusal !== null) throw new GuardError(refusal);

    // The universe's public API (/api/*.xml) never gets the session cookies, whatever the reason.
    const isGame = this.isGameUrl(url) && !this.isPublicApi(url);
    const send = () =>
      this.fetchImpl(url, {
        ...init,
        credentials: isGame ? 'include' : 'omit',
        headers: isGame ? { 'X-Requested-With': 'XMLHttpRequest', ...(init.headers ?? {}) } : init.headers,
      });
    if (!isGame) return send();
    // One session call at a time: two at once make the game answer one of them with
    // {"components":[],"newAjaxToken":…} instead of the data (seen on s269-it, 2026-11-10).
    // The body is read inside the queue, so the next call starts only when this one is done.
    const run = this.sessionQueue.then(async () => {
      const res = await send();
      return new Response(await res.text(), { status: res.status, statusText: res.statusText, headers: res.headers });
    });
    this.sessionQueue = run.catch(() => undefined);
    return run;
  }

  private sessionQueue: Promise<unknown> = Promise.resolve();

  private check(url: string, reason: CallReason): string | null {
    if (reason === 'page-load' && !this.pageLoadOpen) {
      return 'Background call refused: the page has finished loading (AGENTS.md §4).';
    }
    if (reason === 'user-view' && !this.isPublicApi(url) && !this.isPtre(url)) {
      return "Call refused: 'user-view' reaches only the universe's public API and PTRE (AGENTS.md §6).";
    }
    if (this.isOutside(url) && !this.isPtre(url)) {
      return 'Call refused: no outside service but the PTRE scripts Future lists (PTRE_SCRIPTS).';
    }
    if (this.isPtre(url) && reason === 'page-load') {
      return 'Call refused: PTRE only from what the player opens or clicks, never on its own.';
    }
    // The team's calls carry the player's key: only from a click, never from simply looking at a page.
    if (this.isPtre(url) && reason === 'user-view' && new URL(url).searchParams.has('team_key')) {
      return 'Call refused: a call with the team key needs a click of the player (user-sync).';
    }
    if (this.isGameUrl(url) && new URL(url, this.gameOrigin).searchParams.has('cp')) {
      return 'Call refused: the cp parameter changes the active planet (AGENTS.md §4.2).';
    }
    return null;
  }

  private isPublicApi(url: string): boolean {
    return this.isGameUrl(url) && /^\/api\/\w+\.xml$/.test(new URL(url, this.gameOrigin).pathname);
  }

  private isPtre(url: string): boolean {
    const u = new URL(url, this.gameOrigin);
    const path = `${u.origin}${u.pathname}`;
    return path.startsWith(PTRE_BASE) && Object.hasOwn(PTRE_SCRIPTS, path.slice(PTRE_BASE.length));
  }

  private isOutside(url: string): boolean {
    return !this.isGameUrl(url);
  }

  private isGameUrl(url: string): boolean {
    return new URL(url, this.gameOrigin).origin === new URL(this.gameOrigin).origin;
  }
}
