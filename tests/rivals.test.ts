import { describe, expect, it } from 'vitest';
import type { PlayerScores } from '../src/data/player-api';
import { gaps, pointsPerDay, recordPoints, RIVALS_MAX, toggleRival, type Rival } from '../src/engines/rivals';

const DAY = 86_400_000;
const scores = (id: number, at: number, total: number, military?: number): PlayerScores => ({
  id, name: `p${id}`, at, ships: null, scores: { total: { points: total, rank: 10 }, ...(military === undefined ? {} : { military: { points: military, rank: 5 } }) },
});

describe('rivals', () => {
  it('toggles and caps the list', () => {
    let list: Rival[] = [];
    for (let i = 1; i <= RIVALS_MAX + 2; i++) list = toggleRival(list, { id: i, name: `p${i}`, at: i });
    expect(list).toHaveLength(RIVALS_MAX);
    expect(toggleRival(list, { id: 3, name: 'p3', at: 0 }).some((r) => r.id === 3)).toBe(false);
  });

  it('records one reading per day and measures growth', () => {
    let book = recordPoints({}, scores(7, Date.UTC(2026, 10, 1, 12), 1000));
    book = recordPoints(book, scores(7, Date.UTC(2026, 10, 1, 20), 1100));
    expect(book['7']).toHaveLength(1);
    expect(pointsPerDay(book, 7, 7)).toBeNull();
    book = recordPoints(book, scores(7, Date.UTC(2026, 10, 1, 20) + 4 * DAY, 1500));
    expect(pointsPerDay(book, 7, 7)).toBe(100);
  });

  it('gives the gap per category, null where a side is missing', () => {
    expect(gaps(scores(1, 0, 1000, 50), scores(2, 0, 1200))).toMatchObject({ total: 200, military: null });
    expect(gaps(null, scores(2, 0, 1200)).total).toBeNull();
  });
});
