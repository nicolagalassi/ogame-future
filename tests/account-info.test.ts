import { describe, expect, it, vi } from 'vitest';
import { NetworkGuard } from '../src/core/guard';
import { MemoryStore, Store } from '../src/core/storage';
import { hydrateAccountOncePerSession, parseAccountInfo } from '../src/data/account-info';

const sample = {
  planets: {
    '1': { id: 1, name: 'Yolen', galaxy: 5, system: 185, position: 2, siblingId: 2,
      production: { metal: 100, crystal: 50, deuterium: 20 }, buildings: { '1': 45 } },
  },
  moons: {
    '2': { id: 2, name: 'Luna', galaxy: 5, system: 185, position: 2, siblingId: 1, production: {} },
  },
  researches: { '122': 20 },
};

class FakeSession {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

describe('parseAccountInfo', () => {
  it('maps planets and moons with coords and siblings', () => {
    const s = parseAccountInfo(sample, 0);
    expect(s.bodies).toHaveLength(2);
    expect(s.bodies[0]).toMatchObject({ type: 'planet', name: 'Yolen', coords: '5:185:2', siblingId: 2 });
    expect(s.bodies[0]?.levels['1']).toBe(45);
    expect(s.bodies[0]?.resourcesAt).toBe(0);
    expect(s.bodies[1]).toMatchObject({ type: 'moon', siblingId: 1 });
    expect(s.researches['122']).toBe(20);
  });

  it('turns missing values into 0, never NaN', () => {
    const s = parseAccountInfo({ planets: [{ id: 3, production: { metal: 'x' } }] }, 0);
    expect(s.bodies[0]?.production.metal).toBe(0);
    expect(s.bodies[0]?.coords).toBe('0:0:0');
  });

  it('survives an empty or broken response', () => {
    expect(parseAccountInfo(null, 0).bodies).toEqual([]);
  });
});

describe('hydrateAccountOncePerSession', () => {
  it('reads accountInfo only once per session', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(sample)));
    const deps = {
      guard: new NetworkGuard(fetchImpl, 'https://s1-it.ogame.gameforge.com'),
      store: new Store(new MemoryStore(), 'future:test:1'),
      session: new FakeSession(),
    };
    await hydrateAccountOncePerSession(deps);
    const again = await hydrateAccountOncePerSession(deps);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(again?.bodies).toHaveLength(2);
    expect(String(fetchImpl.mock.calls[0]?.[0])).not.toContain('cp=');
  });
});
