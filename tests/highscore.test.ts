// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { readHighscore } from '../src/data/highscore';
import { decorateHighscore, watchHighscore } from '../src/modules/highscore';
import { parsePtreRanks, ptreRanks, ptreServer, PTRE_KEY } from '../src/data/ptre';
import { NetworkGuard } from '../src/core/guard';
import { MemoryStore, Store } from '../src/core/storage';
import { translator } from '../src/core/i18n';
import { HISTORY_KEY, recordDay, type History } from '../src/engines/history';
import { MARKS_KEY } from '../src/engines/marks';

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

  it('shows the points since the PTRE snapshot, its age, the player flag and marks the top three', async () => {
    page();
    document.querySelector('#ranks')!.insertAdjacentHTML('afterbegin', '<thead><tr><td class="position">#</td><td class="name">Nome</td><td class="score">Punti</td></tr></thead>');
    document.body.insertAdjacentHTML('afterbegin', '<p class="fut-hs-note">old note</p>');
    const now = new Date(2026, 10, 8, 15).getTime();
    const store = new Store(new MemoryStore(), 'x');
    let h: History = [];
    h = recordDay(h, { at: new Date(2026, 10, 1, 12).getTime(), points: 930_000_000, rank: 12, prodDay: 0, fleet: 0 });
    h = recordDay(h, { at: new Date(2026, 10, 8, 12).getTime(), points: 1_000_000_000, rank: 11, prodDay: 0, fleet: 0 });
    store.set(HISTORY_KEY, h);
    // PTRE's snapshot at midnight, read an hour ago: no new call needed.
    store.set(PTRE_KEY, { readAt: now - 3_600_000, at: new Date(2026, 10, 8, 0).getTime(), scores: { 1: 1_090_000_000, 2: 1_000_000_000, 3: 995_000_000 } });
    const fetchImpl = vi.fn();
    const o = { doc: document, store, locale: 'it', t: translator('it'), guard: new NetworkGuard(fetchImpl, 'https://s1-it.ogame.gameforge.com'), now: () => now };
    decorateHighscore(o);
    await vi.waitFor(() => expect(document.querySelector('#position1 .fut-hs-gap')).not.toBeNull());
    expect(fetchImpl).not.toHaveBeenCalled();
    const ahead = document.getElementById('position1')!;
    expect(ahead.querySelector('.fut-hs-gap')?.textContent).toBe('+10,0M');
    expect(ahead.querySelector('.fut-hs-gap')?.className).toContain('up');
    expect(document.querySelector('#position2 .fut-hs-gap')).toBeNull();
    expect(document.querySelector('#position3 .fut-hs-gap')?.textContent).toBe('−5,0M');
    expect(document.querySelector('#position3 .fut-hs-gap')?.className).toContain('down');
    expect(document.querySelector('#ranks thead .fut-hs-age')?.textContent).toBe('(Δ 15h)');
    expect(document.querySelector('.fut-hs-note')).toBeNull();
    expect(ahead.querySelector('.fut-hs-eta')).toBeNull();
    expect(document.querySelector('.fut-hs-top')).toBeNull();
    expect(document.getElementById('position2')!.querySelector('.fut-mk-flag')).toBeNull();
    (ahead.querySelector<HTMLButtonElement>('.fut-mk-flag')!).dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    expect(store.get<{ players: Record<string, { flag: string }> }>(MARKS_KEY, { players: {} }).players['1']?.flag).toBe('watch');
    expect(document.querySelectorAll('#position1 .fut-hs-gap')).toHaveLength(1);
    expect(document.querySelectorAll('#ranks thead .fut-hs-age')).toHaveLength(1);
  });
});

describe('compact rows and back to top', () => {
  it('keeps the top three roomy and adds one back-to-top button', () => {
    page();
    document.getElementById('position2')!.querySelector('.position')!.textContent = '2';
    const o = { doc: document, store: new Store(new MemoryStore(), 'y'), locale: 'it', t: translator('it') };
    watchHighscore(o);
    watchHighscore(o);
    expect([...document.querySelectorAll('.fut-hs-top')].map((r) => r.id)).toEqual(['position2']);
    expect(document.querySelectorAll('#fut-hs-top')).toHaveLength(1);
  });
});

describe('PTRE ranking snapshot', () => {
  const answer = { code: 1, message: 'Got ranks for TS 1794265200.', ranks_array: [{ player_id: '7', timestamp: '1794265200', total_rank: '1', total_score: '6535295477', status: '' }], ranks_array_last: [] };

  it('parses the answer and the server', () => {
    expect(parsePtreRanks(answer, 9)).toEqual({ readAt: 9, at: 1_794_265_200_000, scores: { 7: 6_535_295_477 } });
    expect(parsePtreRanks({ code: 0, message: 'no' }, 9)).toBeNull();
    expect(ptreServer('s269-it.ogame.gameforge.com')).toEqual({ univers: '269', country: 'it' });
    expect(ptreServer('lobby.ogame.gameforge.com')).toBeNull();
  });

  it('asks PTRE without cookies, sending only the country and the universe, at most every 6 hours', async () => {
    const fetchImpl = vi.fn(async (_u: string, _i?: RequestInit) => new Response(JSON.stringify(answer)));
    const guard = new NetworkGuard(fetchImpl, 'https://s269-it.ogame.gameforge.com');
    guard.closePageLoadWindow();
    const store = new Store(new MemoryStore(), 'x');
    const now = 1_794_300_000_000;
    await ptreRanks({ guard, store, host: 's269-it.ogame.gameforge.com', now });
    await ptreRanks({ guard, store, host: 's269-it.ogame.gameforge.com', now: now + 5 * 3_600_000 });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const url = new URL(String(fetchImpl.mock.calls[0]![0]));
    expect(`${url.origin}${url.pathname}`).toBe('https://ptre.chez.gg/scripts/api_get_ranks.php');
    expect(Object.fromEntries(url.searchParams)).toEqual({ country: 'it', univers: '269', timestamp: '-1', tool: 'future' });
    expect(fetchImpl.mock.calls[0]![1]?.credentials).toBe('omit');
    await ptreRanks({ guard, store, host: 's269-it.ogame.gameforge.com', now: now + 7 * 3_600_000 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
