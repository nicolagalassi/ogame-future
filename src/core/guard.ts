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
 * - The one outside service is PTRE's public ranking (`PTRE_RANKS`), again only as 'user-view' from
 *   the highscore page the player opened, without cookies, as OGLight does (only the country and the
 *   universe number are sent).
 * - The `cp` (change planet) parameter is refused on every game URL:
 *   it mutates the session's active planet.
 * - Every attempt, allowed or refused, is written to an in-memory log so the
 *   behaviour can be shown to a ToolDev during review.
 */

export type CallReason = 'page-load' | 'user-sync' | 'user-view';

/** PTRE's public ranking snapshot, the only outside address Future may call. */
export const PTRE_RANKS = 'https://ptre.chez.gg/scripts/api_get_ranks.php';

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
    this.log.push({ at: this.now(), url, reason, allowed: refusal === null, why: refusal ?? undefined });
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
      return "Call refused: 'user-view' reaches only the universe's public API and PTRE's ranking (AGENTS.md §6).";
    }
    if (this.isOutside(url) && !(reason === 'user-view' && this.isPtre(url))) {
      return 'Call refused: no outside service but PTRE\'s ranking, and only from what the player opens.';
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
    return `${u.origin}${u.pathname}` === PTRE_RANKS;
  }

  private isOutside(url: string): boolean {
    return !this.isGameUrl(url);
  }

  private isGameUrl(url: string): boolean {
    return new URL(url, this.gameOrigin).origin === new URL(this.gameOrigin).origin;
  }
}
