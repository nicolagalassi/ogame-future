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
