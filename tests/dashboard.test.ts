import { beforeEach, describe, expect, it } from 'vitest';
import { readPlanetList } from '../src/data/planet-list';
import { readScore } from '../src/data/score';
import { accountAlerts, bodyRows, summarize } from '../src/engines/account';
import { closeDashboard, isDashboardOpen, openDashboard } from '../src/modules/dashboard';
import { translator } from '../src/core/i18n';
import { PLANET_LIST_HTML, SNAPSHOT } from './fixtures';

const t = translator('it');

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = PLANET_LIST_HTML;
});

describe('readScore', () => {
  it('reads points, rank and total from the overview', () => {
    document.body.insertAdjacentHTML('beforeend', '<span id="scoreContentField"><a>1.977.533.840 (Posizione 6 su 345)</a></span>');
    expect(readScore(document, 5)).toEqual({ points: 1_977_533_840, rank: 6, of: 345, at: 5 });
  });
  it('returns null off the overview', () => {
    expect(readScore(document, 0)).toBeNull();
  });
});

describe('account engine', () => {
  it('builds rows in planet-list order, planet then moon, and sums them', () => {
    const rows = bodyRows(SNAPSHOT, readPlanetList(document), 0);
    expect(rows.map((r) => `${r.type}:${r.id}`)).toEqual(['planet:1', 'moon:2']);
    expect(rows[0]!.idle).toBe(true);
    const sum = summarize(rows);
    expect(sum.planets).toBe(1);
    expect(sum.moons).toBe(1);
    expect(sum.perHour.metal).toBe(10);
  });

  it('flags missing data, full storage and idle planets', () => {
    const entries = readPlanetList(document);
    const alerts = accountAlerts(bodyRows(SNAPSHOT, entries, 0), SNAPSHOT, entries);
    const keys = alerts.map((a) => a.key);
    expect(keys).toContain('alert.missing'); // planet 3 has no data
    expect(keys).toContain('alert.full'); // planet 1 at 38.3M of 40M
    expect(keys).toContain('alert.idle');
    expect(alerts.find((a) => a.key === 'alert.missing')!.names[0]).toBe('Mythos [5:356:8]');
  });
});

describe('dashboard panel', () => {
  const open = () =>
    openDashboard({ doc: document, snapshot: SNAPSHOT, entries: readPlanetList(document), score: null, now: 0, locale: 'it', t });

  it('opens in a shadow root with the bodies table, and closes with Escape', () => {
    open();
    const root = document.getElementById('fut-dashboard')!.shadowRoot!;
    expect(root.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(root.querySelector('tbody a')?.getAttribute('href')).toContain('cp=1');
    expect(root.textContent).not.toMatch(/NaN|undefined/);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(isDashboardOpen(document)).toBe(false);
  });

  it('re-opening does not duplicate the panel', () => {
    open();
    open();
    expect(document.querySelectorAll('#fut-dashboard')).toHaveLength(1);
    closeDashboard(document);
  });

  it('can hide moons', () => {
    open();
    const root = document.getElementById('fut-dashboard')!.shadowRoot!;
    root.querySelector<HTMLButtonElement>('.chip')!.click();
    const after = document.getElementById('fut-dashboard')!.shadowRoot!;
    expect(after.querySelectorAll('tbody tr')).toHaveLength(1);
    after.querySelector<HTMLButtonElement>('.chip')!.click(); // restore for other tests
    closeDashboard(document);
  });
});
