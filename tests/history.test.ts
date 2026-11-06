// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { changeOver, dayKey, HISTORY_MAX, recordDay, type History } from '../src/engines/history';
import { dayFigures, openDashboard, closeDashboard } from '../src/modules/dashboard';
import { translator } from '../src/core/i18n';
import { SNAPSHOT } from './fixtures';

const DAY = 86_400_000;
const at = (d: number, hour = 12) => new Date(2026, 10, d, hour).getTime();

describe('account history', () => {
  it('keeps one entry per day, the latest reading wins but keeps known figures', () => {
    let h: History = [];
    h = recordDay(h, { at: at(2), points: 100, rank: 50, prodDay: 10, fleet: 5 });
    h = recordDay(h, { at: at(1), points: 90, rank: 52, prodDay: 9, fleet: 5 });
    h = recordDay(h, { at: at(2, 20), points: 110, rank: 49, prodDay: 0, fleet: 0 });
    expect(h.map((d) => d.day)).toEqual([dayKey(at(1)), dayKey(at(2))]);
    expect(h[1]).toMatchObject({ points: 110, rank: 49, prodDay: 10, fleet: 5 });
  });

  it('is capped', () => {
    let h: History = [];
    for (let i = 0; i < HISTORY_MAX + 5; i++) h = recordDay(h, { at: at(1) + i * DAY, points: i, rank: null, prodDay: 0, fleet: 0 });
    expect(h).toHaveLength(HISTORY_MAX);
    expect(h[0]!.points).toBe(5);
  });

  it('measures the change over a span, falling back to the oldest day', () => {
    let h: History = [];
    for (const [d, p, r] of [[1, 100, 60], [5, 160, 55], [8, 200, 50]] as const) h = recordDay(h, { at: at(d), points: p, rank: r, prodDay: 0, fleet: 0 });
    expect(changeOver(h, 3)).toEqual({ days: 3, points: 40, rank: 5, perDay: 40 / 3 });
    expect(changeOver(h, 30)).toMatchObject({ days: 7, points: 100, rank: 10 });
    expect(changeOver(h.slice(0, 1), 7)).toBeNull();
  });

  it('takes production and fleet from the snapshot', () => {
    const f = dayFigures(SNAPSHOT);
    expect(f.prodDay).toBeGreaterThan(0);
    expect(dayFigures(null)).toEqual({ prodDay: 0, fleet: 0 });
  });

  it('draws the history tab', () => {
    const t = translator('it');
    let history: History = [];
    for (let d = 1; d <= 3; d++) history = recordDay(history, { at: at(d), points: 100_000 * d, rank: 10 - d, prodDay: 500, fleet: 0 });
    openDashboard({ doc: document, snapshot: SNAPSHOT, entries: [], score: null, history, now: at(3), locale: 'it', t });
    const root = document.getElementById('fut-dashboard')!.shadowRoot!;
    root.querySelector<HTMLButtonElement>('.tab[data-tab="history"]')!.click();
    const fresh = document.getElementById('fut-dashboard')!.shadowRoot!;
    expect(fresh.querySelectorAll('.chart polyline')).toHaveLength(2);
    expect(fresh.querySelectorAll('table.history tbody tr')).toHaveLength(3);
    expect(fresh.querySelector('.kpi .value')?.textContent).toBe('+100.000');
    closeDashboard(document);
  });
});
