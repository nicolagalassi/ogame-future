import { describe, expect, it, vi } from 'vitest';
import { NetworkGuard } from '../src/core/guard';
import { MemoryStore, Store } from '../src/core/storage';
import { ERRORS_KEY, normalTeamKey, ptreSaveSpyReport, TEAM_KEY, type PtreError } from '../src/data/ptre';

const HOST = 's269-it.ogame.gameforge.com';
const KEY = 'TM-AAAA-BBBB-CCCC-DDDD';

function deps(answer: unknown, key: string | null = KEY) {
  const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(answer)));
  const guard = new NetworkGuard(fetchImpl, `https://${HOST}`);
  guard.closePageLoadWindow();
  const store = new Store(new MemoryStore(), 'x');
  if (key) store.set(TEAM_KEY, key);
  return { fetchImpl, store, d: { guard, store, host: HOST, version: '0.3.179', now: () => 5000 } };
}

describe("the team's PTRE", () => {
  it('takes a team key as PTRE checks it: TM and 16 more characters, dashes or not', () => {
    expect(normalTeamKey(' tm-aaaa-bbbb-cccc-dddd ')).toBe(KEY);
    expect(normalTeamKey('TMAAAABBBBCCCCDDDD')).toBe('TMAAAABBBBCCCCDDDD');
    expect(normalTeamKey('TM-AAAA-BBBB-CCCC')).toBeNull();
    expect(normalTeamKey('XX-AAAA-BBBB-CCCC-DDDD')).toBeNull();
  });

  it('saves one spy report by its API id, as OGLight does, with tool = future', async () => {
    const { fetchImpl, d } = deps({ code: 1, message: 'ok', message_verbose: 'Report imported' });
    expect(await ptreSaveSpyReport(d, 'sr-it-269-abc')).toEqual({ ok: true, message: 'Report imported' });
    const [url, init] = fetchImpl.mock.calls[0]!;
    const u = new URL(url);
    expect(`${u.origin}${u.pathname}`).toBe('https://ptre.chez.gg/scripts/oglight_import.php');
    expect(Object.fromEntries(u.searchParams)).toEqual({ sr_id: 'sr-it-269-abc', tool: 'future', team_key: KEY, country: 'it', univers: '269', version: '0.3.179' });
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit' });
  });

  it('without a key sends nothing; a refusal is kept for the errors list', async () => {
    const none = deps({ code: 1 }, null);
    expect((await ptreSaveSpyReport(none.d, 'sr-it-269-abc')).ok).toBe(false);
    expect(none.fetchImpl).not.toHaveBeenCalled();

    const refused = deps({ code: -3, message: 'Bad key' });
    expect(await ptreSaveSpyReport(refused.d, 'sr-it-269-abc')).toEqual({ ok: false, message: 'Bad key' });
    expect(refused.store.get<PtreError[]>(ERRORS_KEY, [])).toEqual([{ at: 5000, code: '-3', message: 'Bad key' }]);
  });
});
