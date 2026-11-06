import { describe, expect, it } from 'vitest';
import { convertOglight, isOglightDb, type OglightDb } from '../src/engines/oglight-import';
import { EMPTY_MARKS, flagPlayer } from '../src/engines/marks';

const db: OglightDb = {
  dataFormat: 17,
  udb: { '7': { uid: 7, name: 'Vega', pin: 'fridge', status: 'v' }, '8': { uid: 8, name: 'Bob', pin: 'rush' }, '9': { uid: 9, name: 'Al' } },
  pdb: {
    '1:300:4': { uid: 7, pid: 41, mid: 42, coo: '1:300:4', acti: ['*', 60, 5000] as [unknown, unknown, number], api: 4000, debris: 1200 },
    '1:300:5': { uid: 9, pid: 51, mid: -1, coo: '1:300:5', acti: ['23', '60', 5000] as [unknown, unknown, number] },
    '2:2:2': { uid: 3, pid: 1, coo: '2:2:2' },
  },
  tdb: { '1:300:5': { tag: 'lime' }, '3:3:3': { tag: 'gray' } },
  lastPinnedList: [9, 7],
};

describe('import from OGLight', () => {
  it('recognises its export and nothing else', () => {
    expect(isOglightDb(db)).toBe(true);
    expect(isOglightDb({ app: 'future', version: 1, data: {} })).toBe(false);
  });

  it('pins become flags, tags colours, readings positions; Future data wins', () => {
    const mine = flagPlayer(EMPTY_MARKS, 8, 'Bob', 'friend', 1);
    const out = convertOglight(db, mine, {}, 9000);
    expect(out.marks.players['7']).toMatchObject({ flag: 'farm', name: 'Vega' });
    expect(out.marks.players['8']!.flag).toBe('friend');
    expect(out.marks.planets['1:300:5']).toMatchObject({ tag: 'green', player: 'Al', playerId: 9, moon: false });
    expect(out.marks.planets['3:3:3']).toBeUndefined();
    expect(out.marks.recent.map((r) => r.id)).toEqual([9, 7]);
    expect(out.positions['1:300:4']).toEqual({ player: 7, name: '', moon: true, debris: 1200, act: ['*', null], at: 5000 });
    expect(out.positions['1:300:5']!.act).toEqual([23, null]);
    expect(out.positions['2:2:2']).toBeUndefined();
    expect([out.players, out.planets, out.seen]).toEqual([1, 1, 2]);
  });
});

import { convertOglightStats } from '../src/engines/oglight-import';
import { entriesIn, periodStats, raidStats } from '../src/engines/expeditions';

describe('OGLight statistics into the journal', () => {
  const stats = {
    '2026-3-11': {
      expe: { count: 10, occurence: { resource: 6, nothing: 3, pirate: 1 }, gain: { metal: 1000, crystal: 500, deut: 100, dm: 20, '202': 5, '-204': 2 } },
      discovery: { count: 4, occurence: { lifeform: 3, artefact: 1 }, gain: { lifeform1: 90, artefact: 7 } },
      raid: { count: 2, gain: { metal: 300, '-215': 1 } },
      debris: { count: 1, gain: { crystal: 200 } },
      debris16: { count: 1, gain: { metal: 50 } },
      conso: 999,
    },
    '2026-3-12': { expe: { count: 3, occurence: { nothing: 3 }, gain: {} } },
  };

  it('one summary per day and kind, raids apart, Future days not doubled', () => {
    // Future logged 12 March itself.
    const own = { r1: { kind: 'expedition' as const, at: new Date(2026, 2, 12, 9).getTime(), result: 'nothing' as const, size: -1, depletion: 0, res: { metal: 0, crystal: 0, deuterium: 0, darkMatter: 0, food: 0 }, ships: {}, lost: {}, item: null, lfXp: 0, lifeform: 0, artefacts: 0, coords: null } };
    const out = convertOglightStats(stats, own);
    expect([out.days, out.expeditions, out.raids]).toEqual([1, 10, 2]);
    const all = entriesIn(out.journal, [0, Infinity]);
    const s = periodStats(all);
    expect([s.count, s.discoveries]).toEqual([11, 4]);
    expect(s.outcomes).toMatchObject({ resource: 6, nothing: 4, pirate: 1, lifeform: 3, artefact: 1 });
    expect(s.res).toMatchObject({ metal: 1050, crystal: 500, deuterium: 100, darkMatter: 20 });
    expect([s.shipsFound[202], s.lost[204], s.lfXp, s.artefacts]).toEqual([5, 2, 90, 7]);
    const r = raidStats(all);
    expect([r.count, r.res.metal, r.res.crystal, r.lost[215]]).toEqual([2, 300, 200, 1]);
    // Importing twice adds nothing.
    expect(convertOglightStats(stats, out.journal).days).toBe(0);
  });
});
