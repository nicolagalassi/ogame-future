// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { daysToCatch, readHighscore } from '../src/data/highscore';
import { decorateHighscore } from '../src/modules/highscore';
import { dailyBase, parseHighscoreXml, updateBase } from '../src/data/highscore-api';
import { NetworkGuard } from '../src/core/guard';
import { MemoryStore, Store } from '../src/core/storage';
import { translator } from '../src/core/i18n';
import { dayKey, HISTORY_KEY, recordDay, type History } from '../src/engines/history';
import { RIVALS_KEY } from '../src/engines/rivals';

// Shape of the game's highscore table (OGame 13.1), made-up players.
const row = (id: number, rank: number, name: string, score: number, mine = false) =>
  `<tr class="${mine ? ' myrank ' : ' '}" id="position${id}"><td class="position">${rank}</td><td class="name"><div class="highscoreNameHolder"><a><span class="playername">${name}</span></a></div></td><td class="score">${score.toLocaleString('it')}</td></tr>`;

function page() {
  document.body.innerHTML = `<div id="categoryButtons"><a id="player" class="active navButton"></a><a id="alliance" class="navButton"></a></div><div id="typeButtons"><a id="points" class="stat_filter active navButton fleft"></a></div>
    <div id="stat_list_content"><table id="ranks"><tbody>${row(1, 10, 'Ahead', 1_100_000_000)}${row(2, 11, 'Me', 1_000_000_000, true)}${row(3, 12, 'Behind', 990_000_000)}</tbody></table></div>`;
}

describe('highscore page', () => {
  it('reads the players table', () => {
    page();
    const hs = readHighscore(document)!;
    expect(hs.category).toBe('points');
    expect(hs.rows.map((r) => [r.playerId, r.rank, r.name, r.score, r.mine])).toEqual([[1, 10, 'Ahead', 1_100_000_000, false], [2, 11, 'Me', 1_000_000_000, true], [3, 12, 'Behind', 990_000_000, false]]);
  });

  it('works out the days to catch up', () => {
    expect(daysToCatch(100, 10)).toBe(10);
    expect(daysToCatch(100, 10, 5)).toBe(20);
    expect(daysToCatch(100, 5, 10)).toBeNull();
    expect(daysToCatch(-5, 1)).toBe(0);
  });

  it('shows the points made since midnight, days to catch up and the rival star', async () => {
    page();
    const now = new Date(2026, 10, 8, 15).getTime();
    const store = new Store(new MemoryStore(), 'x');
    let h: History = [];
    h = recordDay(h, { at: new Date(2026, 10, 1, 12).getTime(), points: 930_000_000, rank: 12, prodDay: 0, fleet: 0 });
    h = recordDay(h, { at: new Date(2026, 10, 8, 12).getTime(), points: 1_000_000_000, rank: 11, prodDay: 0, fleet: 0 });
    store.set(HISTORY_KEY, h);
    // Today's base, read an hour ago: no new API call needed.
    const reading = { at: new Date(2026, 10, 8, 0, 5).getTime(), readAt: now - 3_000_000, scores: { 1: 1_090_000_000, 2: 1_000_000_000, 3: 995_000_000 } };
    store.set('hs.daily.0', { day: dayKey(now), base: reading, last: reading });
    const fetchImpl = vi.fn();
    const o = { doc: document, store, locale: 'it', t: translator('it'), guard: new NetworkGuard(fetchImpl, 'https://s1-it.ogame.gameforge.com'), now: () => now };
    decorateHighscore(o);
    await vi.waitFor(() => expect(document.querySelector('#position1 .fut-hs-gap')).not.toBeNull());
    expect(fetchImpl).not.toHaveBeenCalled();
    const ahead = document.getElementById('position1')!;
    expect(ahead.querySelector('.fut-hs-gap')?.textContent).toBe('+10,0M');
    expect(ahead.querySelector('.fut-hs-gap')?.className).toContain('up');
    expect(document.querySelector('#position2 .fut-hs-gap')?.textContent).toBe('0');
    expect(document.querySelector('#position3 .fut-hs-gap')?.textContent).toBe('−5,0M');
    expect(document.querySelector('#position3 .fut-hs-gap')?.className).toContain('down');
    expect(ahead.querySelector('.fut-hs-eta')?.textContent).toBe('ti avvicini: 10 g');
    expect(document.querySelector('.fut-hs-note')?.textContent).toContain('00:05');
    expect(document.getElementById('position2')!.querySelector('.fut-hs-star')).toBeNull();
    ahead.querySelector<HTMLButtonElement>('.fut-hs-star')!.click();
    expect(store.get<{ id: number }[]>(RIVALS_KEY, []).map((r) => r.id)).toEqual([1]);
    expect(document.getElementById('position1')!.classList.contains('fut-hs-rival')).toBe(true);
    expect(document.querySelectorAll('#position1 .fut-hs-gap')).toHaveLength(1);
  });
});

describe('daily base from the public highscore', () => {
  const xml = (ts: number, score: number) => `<?xml version="1.0"?><highscore category="1" type="0" timestamp="${ts}"><player position="1" id="7" score="${score}"/></highscore>`;

  it('parses the file', () => {
    expect(parseHighscoreXml(xml(1000, 55.5), 9)).toEqual({ at: 1_000_000, readAt: 9, scores: { 7: 55 } });
    expect(parseHighscoreXml('nope', 9)).toBeNull();
  });

  it('keeps the first reading of the day, or yesterday 23:xx when close to midnight', () => {
    const r = (d: number, hh: number, score: number) => ({ at: new Date(2026, 10, d, hh, 10).getTime(), readAt: 0, scores: { 7: score } });
    let b = updateBase(null, r(8, 9, 100));
    b = updateBase(b, r(8, 14, 150));
    expect([b.base.scores[7], b.last.scores[7]]).toEqual([100, 150]);
    b = updateBase(b, r(8, 23, 200));
    const next = updateBase(b, r(9, 0, 210));
    expect(next.base.scores[7]).toBe(200);
    expect(updateBase(updateBase(null, r(8, 20, 1)), r(9, 3, 2)).base.scores[7]).toBe(2);
  });

  it('asks the public API without cookies, at most once an hour', async () => {
    const fetchImpl = vi.fn(async (_u: string, _i?: RequestInit) => new Response(xml(Math.floor(new Date(2026, 10, 8, 10).getTime() / 1000), 5)));
    const guard = new NetworkGuard(fetchImpl, 'https://s1-it.ogame.gameforge.com');
    guard.closePageLoadWindow();
    const store = new Store(new MemoryStore(), 'x');
    const now = new Date(2026, 10, 8, 10, 30).getTime();
    await dailyBase({ guard, store, origin: 'https://s1-it.ogame.gameforge.com', type: 0, now });
    await dailyBase({ guard, store, origin: 'https://s1-it.ogame.gameforge.com', type: 0, now: now + 600_000 });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(String(fetchImpl.mock.calls[0]![0])).toContain('/api/highscore.xml?category=1&type=0');
    expect(fetchImpl.mock.calls[0]![1]?.credentials).toBe('omit');
  });
});
