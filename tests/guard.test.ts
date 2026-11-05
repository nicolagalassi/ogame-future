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
    await guard.request('https://ogapi.faw-kes.de/players', 'page-load');
    expect(fetchImpl.mock.calls[0]?.[1]?.credentials).toBe('include');
    expect(fetchImpl.mock.calls[1]?.[1]?.credentials).toBe('omit');
  });
});
