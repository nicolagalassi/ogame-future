// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { daysToCatch, readHighscore } from '../src/data/highscore';
import { decorateHighscore } from '../src/modules/highscore';
import { MemoryStore, Store } from '../src/core/storage';
import { translator } from '../src/core/i18n';
import { HISTORY_KEY, recordDay, type History } from '../src/engines/history';
import { RIVALS_KEY } from '../src/engines/rivals';

// Shape of the game's highscore table (OGame 13.1), made-up players.
const row = (id: number, rank: number, name: string, score: number, mine = false) =>
  `<tr class="${mine ? ' myrank ' : ' '}" id="position${id}"><td class="position">${rank}</td><td class="name"><div class="highscoreNameHolder"><a><span class="playername">${name}</span></a></div></td><td class="score">${score.toLocaleString('it')}</td></tr>`;

function page() {
  document.body.innerHTML = `<a id="player" class="active navButton"></a><div id="categoryButtons"><a id="points" class="stat_filter active navButton"></a></div>
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

  it('shows gap, days to catch up and the rival star', () => {
    page();
    const store = new Store(new MemoryStore(), 'x');
    let h: History = [];
    h = recordDay(h, { at: Date.UTC(2026, 10, 1, 12), points: 930_000_000, rank: 12, prodDay: 0, fleet: 0 });
    h = recordDay(h, { at: Date.UTC(2026, 10, 8, 12), points: 1_000_000_000, rank: 11, prodDay: 0, fleet: 0 });
    store.set(HISTORY_KEY, h);
    const o = { doc: document, store, locale: 'it', t: translator('it') };
    decorateHighscore(o);
    const ahead = document.getElementById('position1')!;
    expect(ahead.querySelector('.fut-hs-gap')?.textContent).toBe('+100M');
    expect(ahead.querySelector('.fut-hs-eta')?.textContent).toBe('ti avvicini: 10 g');
    expect(document.getElementById('position3')!.querySelector('.fut-hs-gap')?.textContent).toBe('−10,0M');
    expect(document.getElementById('position2')!.querySelector('.fut-hs-star')).toBeNull();
    ahead.querySelector<HTMLButtonElement>('.fut-hs-star')!.click();
    expect(store.get<{ id: number }[]>(RIVALS_KEY, []).map((r) => r.id)).toEqual([1]);
    expect(document.getElementById('position1')!.classList.contains('fut-hs-rival')).toBe(true);
    expect(document.querySelectorAll('#position1 .fut-hs-gap')).toHaveLength(1);
  });
});
