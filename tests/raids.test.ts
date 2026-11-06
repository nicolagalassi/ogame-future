import { describe, expect, it } from 'vitest';
import type { SpyMessage } from '../src/data/messages';
import { distance, flightSeconds, rememberSpies, SPY_MAX_AGE, targetRows, type SpyBoard, type Universe } from '../src/engines/raids';
import { sortRows } from '../src/modules/messages/spy-table';

const U: Universe = { galaxies: 9, systems: 499, donutGalaxy: true, donutSystem: true, fleetSpeed: 2 };
const spy = (over: Partial<SpyMessage>): SpyMessage => ({
  kind: 'spy', id: '1', at: 1000, coords: '1:476:11', moon: false, playerId: 5, playerName: 'Bob', statuses: ['inactive'], counter: false,
  sourceName: '', sourceCoords: '', activity: 60, res: { metal: 1000, crystal: 1000, deuterium: 1000, food: 0 }, loot: 0.5, fleetValue: 0, defValue: 0, attacked: false, ...over,
});

describe('spy board', () => {
  it('keeps the newest report per planet or moon and skips counter-espionage', () => {
    const board: SpyBoard = {};
    rememberSpies(board, [spy({ id: 'a', at: 2000 }), spy({ id: 'b', at: 1000 }), spy({ id: 'c', moon: true }), spy({ id: 'd', counter: true, coords: '2:2:2' })], 3000);
    expect(Object.keys(board).sort()).toEqual(['1:476:11', '1:476:11:m']);
    expect(board['1:476:11']!.id).toBe('a');
    expect(rememberSpies(board, [], 2000 + SPY_MAX_AGE + 1)).toBe(2);
    expect(board).toEqual({});
  });

  it('measures distance like the game, with donut galaxies and systems', () => {
    expect(distance('1:473:7', '1:476:11', U)).toBe(2985);
    expect(distance('1:1:1', '9:1:1', U)).toBe(20_000);
    expect(distance('1:1:1', '1:499:1', U)).toBe(2_795);
    expect(distance('1:1:1', '1:1:9', U)).toBe(1_040);
    expect(distance('1:1:1', '1:1:1', U)).toBe(5);
  });

  it('times flights as the game does (values from fleetHelper.calcDuration, s808)', () => {
    expect(flightSeconds(2985, 28180, U)).toBe(1806);
    expect(flightSeconds(80_000, 28180, U)).toBe(9329);
    expect(flightSeconds(2700 + 95 * 200, 28180, U)).toBe(4861);
  });

  it('ranks targets by loot per hour of flight from the nearest base', () => {
    const board: SpyBoard = {};
    rememberSpies(board, [spy({ coords: '1:476:11' }), spy({ id: '2', coords: '5:100:1', res: { metal: 4000, crystal: 0, deuterium: 0, food: 0 } })], 1000);
    const bases = [{ id: 1, name: 'Home', coords: '1:473:7', moon: false }, { id: 2, name: 'Far', coords: '4:1:1', moon: false }];
    const rows = targetRows(board, bases, { capacity: 1000, speed: 28180, universe: U, now: 61_000 });
    const near = rows.find((r) => r.entry.coords === '1:476:11')!;
    expect(near).toMatchObject({ lootRes: 1500, lootMsu: 2750, ships: 2, flight: 1806, ageMinutes: 1 });
    expect(near.base?.name).toBe('Home');
    expect(near.msuPerHour).toBeCloseTo(2750 / ((2 * 1806) / 3600));
    const sorted = sortRows(rows, { sort: 'rate', desc: true, ship: 203, hideDefended: false, inactiveOnly: false });
    expect(sorted[0]!.entry.coords).toBe('1:476:11');
    expect(targetRows(board, bases, { capacity: 1000, speed: 0, universe: U, now: 0 })[0]!.msuPerHour).toBeNull();
  });
});
