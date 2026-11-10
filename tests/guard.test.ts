import { describe, expect, it, vi } from 'vitest';
import { GuardError, NetworkGuard } from '../src/core/guard';

const ORIGIN = 'https://s1-it.ogame.gameforge.com';
const ok = () => vi.fn(async (_url: string, _init?: RequestInit) => new Response("{}"));

describe('NetworkGuard', () => {
  it('allows page-load calls while the page is loading', async () => {
    const fetchImpl = ok();
    const guard = new NetworkGuard(fetchImpl, ORIGIN);
    await guard.request('/game/index.php?page=x', 'page-load');
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(guard.log[0]?.allowed).toBe(true);
  });

  it('refuses page-load calls after the window closes', async () => {
    const fetchImpl = ok();
    const guard = new NetworkGuard(fetchImpl, ORIGIN);
    guard.closePageLoadWindow();
    await expect(guard.request('/game/index.php?page=x', 'page-load')).rejects.toBeInstanceOf(GuardError);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(guard.log[0]?.allowed).toBe(false);
  });

  it('still allows user-initiated sync after the window closes', async () => {
    const fetchImpl = ok();
    const guard = new NetworkGuard(fetchImpl, ORIGIN);
    guard.closePageLoadWindow();
    await guard.request('/game/index.php?page=x', 'user-sync');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('refuses the cp parameter on game URLs', async () => {
    const fetchImpl = ok();
    const guard = new NetworkGuard(fetchImpl, ORIGIN);
    await expect(guard.request('/game/index.php?page=x&cp=123', 'page-load')).rejects.toThrow(/cp/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends cookies only to the game, never to other hosts', async () => {
    const fetchImpl = ok();
    const guard = new NetworkGuard(fetchImpl, ORIGIN);
    await guard.request('/game/index.php?page=x', 'page-load');
    await guard.request('https://ptre.chez.gg/scripts/api_get_ranks.php?country=it&univers=1', 'user-view');
    expect(fetchImpl.mock.calls[0]?.[1]?.credentials).toBe('include');
    expect(fetchImpl.mock.calls[1]?.[1]?.credentials).toBe('omit');
  });

  it('refuses every outside service but PTRE ranking, and PTRE only from what the player opens', async () => {
    const fetchImpl = ok();
    const guard = new NetworkGuard(fetchImpl, ORIGIN);
    await expect(guard.request('https://ogapi.faw-kes.de/players', 'page-load')).rejects.toBeInstanceOf(GuardError);
    await expect(guard.request('https://ptre.chez.gg/scripts/api_get_ranks.php', 'page-load')).rejects.toBeInstanceOf(GuardError);
    await expect(guard.request('https://ptre.chez.gg/scripts/api_post_activity.php', 'user-view')).rejects.toBeInstanceOf(GuardError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('lets what the player points at read the public API only, without cookies', async () => {
    const fetchImpl = ok();
    const guard = new NetworkGuard(fetchImpl, ORIGIN);
    guard.closePageLoadWindow();
    await guard.request(`${ORIGIN}/api/playerData.xml?id=5`, 'user-view');
    expect(fetchImpl.mock.calls[0]?.[1]?.credentials).toBe('omit');
    await expect(guard.request('/game/index.php?page=x', 'user-view')).rejects.toThrow(/public API/);
    await expect(guard.request('https://example.com/api/players.xml', 'user-view')).rejects.toThrow(/public API/);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

describe('NetworkGuard session queue', () => {
  it('sends game calls one at a time, and a failure does not block the next', async () => {
    let open = 0, most = 0, n = 0;
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => {
      open++; most = Math.max(most, open);
      await new Promise((r) => setTimeout(r, 5));
      open--;
      if (++n === 2) throw new Error('network');
      return new Response(`{"n":${n}}`);
    });
    const guard = new NetworkGuard(fetchImpl, ORIGIN);
    const [a, b, c] = await Promise.allSettled([
      guard.request('/game/index.php?page=a', 'page-load'),
      guard.request('/game/index.php?page=b', 'page-load'),
      guard.request('/game/index.php?page=c', 'page-load'),
    ]);
    expect(most).toBe(1);
    expect(a.status === 'fulfilled' && (await a.value.json())).toEqual({ n: 1 });
    expect(b.status).toBe('rejected');
    expect(c.status === 'fulfilled' && (await c.value.json())).toEqual({ n: 3 });
  });
});
