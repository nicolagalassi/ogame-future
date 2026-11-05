/**
 * Network guardian: the ONLY place in Future that may talk to a server.
 *
 * COMPLIANCE (AGENTS.md §1.3, §4, §4.2):
 * - Background calls may fire only while the page is loading. After bootstrap
 *   the window closes and any further 'page-load' call is refused.
 * - 'user-sync' calls are allowed later, but only from a handler bound to a
 *   real user click (e.g. the Sync button). Never call it from a timer.
 * - The `cp` (change planet) parameter is refused on every game URL:
 *   it mutates the session's active planet.
 * - Every attempt, allowed or refused, is written to an in-memory log so the
 *   behaviour can be shown to a ToolDev during review.
 */

export type CallReason = 'page-load' | 'user-sync';

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

    const isGame = this.isGameUrl(url);
    return this.fetchImpl(url, {
      ...init,
      credentials: isGame ? 'include' : 'omit',
      headers: isGame ? { 'X-Requested-With': 'XMLHttpRequest', ...(init.headers ?? {}) } : init.headers,
    });
  }

  private check(url: string, reason: CallReason): string | null {
    if (reason === 'page-load' && !this.pageLoadOpen) {
      return 'Background call refused: the page has finished loading (AGENTS.md §4).';
    }
    if (this.isGameUrl(url) && new URL(url, this.gameOrigin).searchParams.has('cp')) {
      return 'Call refused: the cp parameter changes the active planet (AGENTS.md §4.2).';
    }
    return null;
  }

  private isGameUrl(url: string): boolean {
    return new URL(url, this.gameOrigin).origin === new URL(this.gameOrigin).origin;
  }
}
