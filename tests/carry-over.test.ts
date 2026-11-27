import { describe, expect, it } from 'vitest';
import { carryOver, carrySources } from '../src/engines/carry-over';
import { JOURNAL_KEY, record, type Journal } from '../src/engines/expeditions';
import type { History } from '../src/engines/history';
import type { Archive } from '../src/engines/orion';

const OLD = 'future:s150-it.ogame.gameforge.com:100200';
const NEW = 'future:s200-it.ogame.gameforge.com:300400';
const NOW = Date.UTC(2026, 10, 27);
const DAY = 86_400_000;

const expedition = (at: number, coords: string | null) => ({
  kind: 'expedition' as const, at, result: 'resource' as const, size: 1, depletion: 0,
  res: { metal: 1_000_000, crystal: 0, deuterium: 0, darkMatter: 0, food: 0 }, ships: {}, lost: {}, item: null, lfXp: 0, lifeform: 0, artefacts: 0, coords,
});
const day = (d: string, points: number) => ({ day: d, at: Date.parse(d), points, rank: 10, prodDay: 5, fleet: 7 });

const archive: Archive = {
  entries: {
    a1: { id: 'a1', name: 'Anomalia', coords: '3:120:16', located: true, level: 3, stars: 2, mode: 'PvE', kind: 'x', spawnedAt: 1, wave: 2, waves: 3, firstSeen: NOW - 3 * DAY, lastSeen: NOW - 2 * DAY, status: 'running', endedAt: 0, collections: [{ at: NOW - 2 * DAY, wave: 1, waves: 3, cost: 10, lithium: 4, metal: 1, crystal: 2, deuterium: 3, other: [] }] },
  },
  fuel: [{ at: NOW - 2 * DAY, coords: '3:120:16', deut: 500, mission: 18 }],
  battles: { b1: { at: NOW - 2 * DAY, coords: '3:120:16', entry: 'a1', lost: {}, won: true, draw: false } },
};

function backup(): Record<string, unknown> {
  return {
    [`${OLD}:planetMenu.totals`]: false,
    [`${OLD}:keys.map`]: { 'fleet.expedition': 'e' },
    [`${OLD}:marks.view`]: { open: true, flagTab: 'target', player: 100999 },
    [`${OLD}:fleet.settings`]: { mainShip: 202, transportSpeed: 50, favTransport: 33620000, favDeploy: 33620001, sendMode: 'transport', sendTarget: { galaxy: 3, system: 120, position: 8, type: 1 }, skipBodies: [33620000] },
    [`${OLD}:${JOURNAL_KEY}`]: { 900: expedition(NOW - DAY, '3:120:16'), 901: { ...expedition(NOW - DAY + 1000, '4:10:7'), kind: 'raid' }, 5: expedition(NOW - 600 * DAY, null) },
    [`${OLD}:account.history`]: [day('2026-11-20', 100), day('2026-11-21', 110)],
    [`${OLD}:orion.archive`]: archive,
    [`${OLD}:orion.mult`]: { 'A|pve': 2 },
    // Left behind: tied to the old universe's places, players and ids.
    [`${OLD}:marks`]: { players: { 5: { name: 'Bob' } } },
    [`${OLD}:positions`]: { '3:120:8': 1 },
    [`${OLD}:planner`]: { 33620000: [] },
    [`${OLD}:fleet.profiles`]: { 33620000: {} },
    [`${OLD}:orion.ledger`]: { '3:120:16': { coords: '3:120:16' } },
    [`${NEW}:keys.map`]: { 'fleet.expedition': 'x' },
    'future:tour.seen': { board: 1 },
  };
}

describe('carrying a universe over (server merges)', () => {
  it('lists the other universes in the data, with what they would bring', () => {
    expect(carrySources(backup(), NEW)).toEqual([{ ns: OLD, universe: 's150-it', player: '100200', journal: 3, days: 2 }]);
    expect(carrySources(backup(), OLD)).toEqual([{ ns: NEW, universe: 's200-it', player: '300400', journal: 0, days: 0 }]);
  });

  it('brings settings and statistics, never a coordinate, a body id or the old places', () => {
    const here = new Map<string, unknown>([['account.history', [day('2026-11-21', 999), day('2026-11-26', 120)]]]);
    const r = carryOver(backup(), OLD, (k) => here.get(k), NOW);
    expect(Object.keys(r.writes).sort()).toEqual(['account.history', 'exp.journal', 'fleet.settings', 'keys.map', 'marks.view', 'orion.archive', 'orion.mult', 'planetMenu.totals']);
    expect(JSON.stringify(r.writes)).not.toMatch(/\d+:\d+:\d+|33620000|33620001|100999/);
    expect(r.writes['fleet.settings']).toMatchObject({ mainShip: 202, transportSpeed: 50, favTransport: null, favDeploy: null, sendMode: null, sendTarget: null, skipBodies: [] });
    expect(r.writes['marks.view']).toEqual({ open: true, flagTab: 'target', player: null });
    expect(r.writes['keys.map']).toEqual({ 'fleet.expedition': 'e' });
    // This universe's own day stays; the others join it, in order.
    expect((r.writes['account.history'] as History).map((d) => `${d.day}=${d.points}`)).toEqual(['2026-11-20=100', '2026-11-21=999', '2026-11-26=120']);
    // The 600-day-old report is past the journal's limit: not brought, not counted.
    expect(r).toMatchObject({ settings: 4, journal: 2, days: 1, orion: 1 });
    // The anomaly ended where it was: the new universe never lists it again.
    const moved = r.writes['orion.archive'] as Archive;
    expect(moved.entries['a1@s150-it']).toMatchObject({ id: 'a1@s150-it', status: 'collected', endedAt: NOW - 2 * DAY, located: false, coords: '' });
    expect(moved.battles['b1@s150-it']!.entry).toBe('a1@s150-it');
  });

  it('carrying twice changes nothing, and a new report with an old id is still recorded', () => {
    const here = new Map<string, unknown>();
    const run = () => {
      const r = carryOver(backup(), OLD, (k) => here.get(k), NOW);
      for (const [k, v] of Object.entries(r.writes)) here.set(k, v);
      return r;
    };
    run();
    const again = run();
    expect(again).toMatchObject({ journal: 0, days: 0, orion: 0 });
    expect(Object.keys(here.get(JOURNAL_KEY) as Journal)).toHaveLength(2);
    expect((here.get('orion.archive') as Archive).fuel).toHaveLength(1);
    // The new server gives message id 900 again: a different report, recorded.
    const next = record(here.get(JOURNAL_KEY) as Journal, [{ ...expedition(NOW, '1:1:16'), id: '900' }]);
    expect(next.added).toBe(1);
  });
});
