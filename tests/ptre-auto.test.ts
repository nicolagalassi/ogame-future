// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { GuardError, NetworkGuard } from '../src/core/guard';
import { MemoryStore, Store } from '../src/core/storage';
import { ASTRO_KEY, AUTO_KEY, coloniesFor, PLANETS_AT_KEY, ptrePlayerPlanets, ptreSendCounterSpies, TEAM_KEY } from '../src/data/ptre';
import { counterSpyPayload, galaxyPayloads, mergePtrePlanets, statusTag, type SystemRow } from '../src/engines/ptre-galaxy';

const KEY = 'TM-AAAA-BBBB-CCCC-DDDD';
const HOST = 's269-it.ogame.gameforge.com';
const row = (position: number, playerId: number | null, planetId: number | null, moonId: number | null = null, over: Partial<SystemRow> = {}): SystemRow => ({
  position, playerId, planetId, moonId, playerName: playerId ? `P${playerId}` : '', statuses: [], rank: 10, activity: { planet: '*', moon: 25 }, debris: 0, ...over,
});
const ctx = { teamKey: KEY, now: 1000, follow: (id: number) => id === 7, home: (c: string) => c === '1:300:4', scores: () => ({ score: 5, fleet: 2 }) };

function deps(answer: unknown, auto = true) {
  const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(answer)));
  const guard = new NetworkGuard(fetchImpl, `https://${HOST}`);
  guard.closePageLoadWindow();
  const store = new Store(new MemoryStore(), 'x');
  store.set(TEAM_KEY, KEY);
  store.set(AUTO_KEY, auto);
  return { fetchImpl, store, d: { guard, store, host: HOST, lang: 'it', version: '1', now: () => 10_000_000 } };
}

describe('PTRE while playing: what a galaxy system tells', () => {
  it('first look: every occupied position; then only what changed; activity only of followed players', () => {
    const s = { galaxy: 1, system: 300, rows: [row(4, 7, 41, 42, { statuses: ['vacation'] }), row(5, 8, 51)] };
    const first = galaxyPayloads(s, {}, ctx);
    expect(Object.keys(first.positions)).toEqual(['1:300:4', '1:300:5']);
    expect(first.positions['1:300:4']).toMatchObject({ teamkey: KEY, id: 41, player_id: 7, name: 'P7', status: 'v', moon: { id: 42, size: -1 }, old_player_id: -1, timestamp_ig: 1000 });
    expect(Object.keys(first.activities)).toEqual(['1:300:4']);
    expect(first.activities['1:300:4']).toEqual({ id: 41, player_id: 7, teamkey: KEY, mv: true, activity: '*', galaxy: 1, system: 300, position: 4, main: true, cdr_total_size: 0, moon: { id: 42, activity: 25 } });
    // Same system again: no position changed, the memory needs no write.
    expect(galaxyPayloads(s, first.ids, ctx)).toMatchObject({ positions: {}, changed: false });
    // A game administrator's row never goes.
    expect(galaxyPayloads({ ...s, rows: [row(6, 3, 61, null, { statuses: ['admin'] })] }, {}, ctx).positions).toEqual({});
    // A moon appears at 5, the planet at 4 is gone.
    const later = galaxyPayloads({ ...s, rows: [row(5, 8, 51, 52)] }, first.ids, ctx);
    expect(later.positions['1:300:5']).toMatchObject({ moon: { id: 52 }, old_player_id: 8 });
    expect(later.positions['1:300:4']).toMatchObject({ id: -1, player_id: -1, status: false, moon: { id: -1 } });
  });

  it('status letters as OGLight; counter-espionage as OGLight; PTRE planets only when newer', () => {
    expect(statusTag(['inactive', 'longinactive'])).toBe('I');
    expect(statusTag([])).toBe('n');
    expect(counterSpyPayload({ at: 5, sourceId: 9, sourceCoords: '6:109:8' }, KEY)).toEqual({ player_id: 9, teamkey: KEY, galaxy: 6, system: 109, position: 8, spy_message_ts: 5, moon: { activity: '*' }, activity: '*' });
    expect(counterSpyPayload({ at: 5, sourceId: 0, sourceCoords: '6:109:8' }, KEY)).toBeNull();
    const db = { '1:1:1': { player: 9, name: 'Old', moon: false, debris: 0, act: ['*', null] as ['*', null], at: 500 } };
    expect(mergePtrePlanets(db, [{ coords: '1:1:1', playerId: 9, moon: true, at: 400 }])).toBeNull();
    expect(mergePtrePlanets(db, [{ coords: '1:1:1', playerId: 9, moon: true, at: 600 }, { coords: '2:2:2', playerId: 9, moon: false, at: 600 }])).toEqual({
      '1:1:1': { player: 9, name: 'Old', moon: true, debris: 0, act: [null, null], at: 600 },
      '2:2:2': { player: 9, name: '', moon: false, debris: 0, act: [null, null], at: 600 },
    });
  });
});

describe('PTRE while playing: the switch and the guard', () => {
  it("'user-browse' reaches only PTRE's browse scripts", async () => {
    const guard = new NetworkGuard(vi.fn(async () => new Response('{}')), `https://${HOST}`);
    await expect(guard.request('https://ptre.chez.gg/scripts/oglight_import.php', 'user-browse')).rejects.toBeInstanceOf(GuardError);
    await expect(guard.request(`https://${HOST}/game/index.php?page=x`, 'user-browse')).rejects.toBeInstanceOf(GuardError);
    await guard.request('https://ptre.chez.gg/scripts/api_galaxy_get_infos.php?team_key=TM', 'user-browse');
    expect(guard.log.at(-1)).toMatchObject({ allowed: true, url: 'https://ptre.chez.gg/scripts/api_galaxy_get_infos.php?team_key=***' });
  });

  it('with the switch off nothing goes; on, counter-espionage goes as a string body', async () => {
    const off = deps({ code: 1 }, false);
    expect(await ptreSendCounterSpies(off.d, { 21: { player_id: 9 } })).toBe(false);
    expect(off.fetchImpl).not.toHaveBeenCalled();
    // Already imported by another tool (PTRE answers, not with 1): taken as done, not sent again and again.
    expect(await ptreSendCounterSpies(deps({ code: -4, message: 'already imported' }).d, { 21: { player_id: 9 } })).toBe(true);
    const on = deps({ code: 1 });
    expect(await ptreSendCounterSpies(on.d, { 21: { player_id: 9 } })).toBe(true);
    const [url, init] = on.fetchImpl.mock.calls[0]!;
    expect(url).toContain('/scripts/oglight_import_player_activity.php?');
    expect(init).toMatchObject({ method: 'POST', body: '{"21":{"player_id":9}}', credentials: 'omit' });
  });

  it("a player's planets from PTRE at most once an hour", async () => {
    const { fetchImpl, store, d } = deps({ code: 1, galaxy_array: [{ coords: '3:20:8', player_id: '9', moon: { id: 77 }, timestamp_ig: 9_000_000 }], last_astro_level_seen: '13', last_astro_level_seen_timestamp: '9000' });
    expect(await ptrePlayerPlanets(d, 9)).toEqual([{ coords: '3:20:8', playerId: 9, moon: true, at: 9_000_000 }]);
    expect(await ptrePlayerPlanets(d, 9)).toBeNull();
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(store.get<Record<string, number>>(PLANETS_AT_KEY, {})).toEqual({ 9: 10_000_000 });
    // The astrophysics level the team saw comes with them: kept for the sheet.
    expect(store.get(ASTRO_KEY, {})).toEqual({ 9: { level: 13, at: 9_000_000 } });
    expect([0, 1, 2, 13, 26].map(coloniesFor)).toEqual([0, 1, 1, 7, 13]);
  });
});
