import { describe, expect, it } from 'vitest';
import { ageParts, planetsOf, recordSystem, type Positions, type SeenRow } from '../src/engines/positions';
import { readActivity } from '../src/data/galaxy';

const row = (position: number, playerId: number | null, extra: Partial<SeenRow> = {}): SeenRow => ({
  position, playerId, planetId: playerId ? position * 10 : null, planetName: `P${position}`, moonId: null, debris: 0, activity: { planet: null, moon: null }, ...extra,
});

describe('positions seen in the galaxy', () => {
  it('keeps only the owners worth keeping, with moon, debris and activity', () => {
    const db = recordSystem({}, 1, 300, [row(4, 7, { moonId: 42, debris: 1200.4, activity: { planet: '*', moon: 23 } }), row(5, 8)], (id) => id === 7, 1000)!;
    expect(Object.keys(db)).toEqual(['1:300:4']);
    expect(db['1:300:4']).toEqual({ player: 7, name: 'P4', moon: true, debris: 1200, act: ['*', 23], at: 1000 });
  });

  it('returns null when nothing is worth writing', () => {
    expect(recordSystem({}, 1, 300, [row(5, 8)], () => false, 1000)).toBeNull();
  });

  it('notices a kept position that is now empty or taken by someone else', () => {
    const before: Positions = { '1:300:4': { player: 7, name: 'P4', moon: false, debris: 0, act: [null, null], at: 1 }, '1:300:6': { player: 7, name: 'P6', moon: false, debris: 0, act: [null, null], at: 1 } };
    const db = recordSystem(before, 1, 300, [row(6, 9)], () => false, 2000)!;
    expect(db['1:300:4']).toMatchObject({ player: 0, at: 2000 });
    expect(db['1:300:6']).toMatchObject({ player: 9, name: 'P6' });
  });

  it('merges the API list with what the galaxy showed since', () => {
    const db: Positions = {
      '1:300:4': { player: 0, name: '', moon: false, debris: 0, act: [null, null], at: 5000 },
      '2:10:8': { player: 7, name: 'New', moon: true, debris: 0, act: [null, null], at: 5000 },
      '1:200:1': { player: 7, name: 'Renamed', moon: true, debris: 0, act: ['*', '*'], at: 5000 },
    };
    const api = { at: 9000, updated: 3000, planets: [{ coords: '1:300:4', name: 'Gone', moon: null }, { coords: '1:200:1', name: 'Old', moon: null }, { coords: '3:1:1', name: 'Far', moon: {} }] };
    const lines = planetsOf(7, api, db);
    expect(lines.map((l) => [l.coords, l.name, l.moon, l.fresh])).toEqual([
      ['1:200:1', 'Renamed', true, false],
      ['2:10:8', 'New', true, true],
      ['3:1:1', 'Far', true, false],
    ]);
    expect(lines[0]!.seen?.act).toEqual(['*', '*']);
    expect(lines[2]!.seen).toBeNull();
  });

  it('reads the game activity marks', () => {
    const cell = (html: string) => {
      const d = document.createElement('div');
      d.innerHTML = html;
      return d;
    };
    expect(readActivity(cell('<div class="activity minute15"></div>'))).toBe('*');
    expect(readActivity(cell('<div class="activity showMinutes">34</div>'))).toBe(34);
    expect(readActivity(cell(''))).toBeNull();
  });

  it('shortens ages', () => {
    expect(ageParts(5 * 60_000)).toEqual({ n: 5, unit: 'm' });
    expect(ageParts(3 * 3_600_000)).toEqual({ n: 3, unit: 'h' });
    expect(ageParts(3 * 86_400_000)).toEqual({ n: 3, unit: 'd' });
  });
});
