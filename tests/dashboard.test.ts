import { beforeEach, describe, expect, it } from 'vitest';
import { readPlanetList } from '../src/data/planet-list';
import { readScore, watchScore } from '../src/data/score';
import { accountAlerts, bodyRows, summarize } from '../src/engines/account';
import { closeDashboard, groupSteps, isDashboardOpen, openDashboard, scrapReturn, TABS } from '../src/modules/dashboard';
import { lfResearch, techName } from '../src/data/tech-names';
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
  it('waits for the game to fill the field, once', async () => {
    document.body.insertAdjacentHTML('beforeend', '<span id="scoreContentField"></span>');
    const field = document.getElementById('scoreContentField')!;
    const seen: number[] = [];
    watchScore(document, () => 7, (s) => seen.push(s.rank ?? 0));
    expect(seen).toEqual([]);
    field.textContent = '1.978_';
    await Promise.resolve();
    expect(seen).toEqual([]);
    field.innerHTML = '<a>1.978.540.738 (Posizione 1.053 su 3.058)</a>';
    await Promise.resolve();
    field.innerHTML = '<a>1 (Posizione 2 su 3)</a>';
    await Promise.resolve();
    expect(seen).toEqual([1053]);
    field.remove();
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
  const shadow = () => document.getElementById('fut-dashboard')!.shadowRoot!;
  const goTo = (tab: string) => shadow().querySelector<HTMLButtonElement>(`.tab[data-tab="${tab}"]`)!.click();

  it('opens on the summary in a shadow root, without the old bodies table, and closes with Escape', () => {
    open();
    expect(shadow().querySelector('.tab[aria-pressed="true"]')?.textContent).toBe('Riepilogo');
    expect(shadow().querySelectorAll('.kpi')).toHaveLength(6);
    expect(shadow().textContent).not.toMatch(/NaN|undefined/);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(isDashboardOpen(document)).toBe(false);
  });

  it('the investments card leads to its own tab, with the trade rates', () => {
    open();
    expect(shadow().querySelectorAll('.card .move').length).toBeLessThanOrEqual(5);
    shadow().querySelector<HTMLButtonElement>('.head-toggle')!.click();
    expect(shadow().querySelector('.tab[aria-pressed="true"]')?.getAttribute('data-tab')).toBe('investments');
    expect(shadow().querySelectorAll('.field.rate')).toHaveLength(3);
    expect(shadow().querySelectorAll('.move').length).toBeGreaterThan(0);
    expect(shadow().textContent).not.toMatch(/NaN|undefined|Infinity/);
    goTo('summary');
    closeDashboard(document);
  });

  it('groups consecutive steps of the same technology and level, one chip per planet', () => {
    const step = (planetId: number, id = 12109, from = 6) => ({ kind: 'lfBuilding' as const, id, planetId, name: `P${planetId}`, coords: '1:1:1', from, to: from + 1, cost: { metal: 1, crystal: 1, deuterium: 0, energy: 0 }, gain: { metal: 0, crystal: 1, deuterium: 0 }, days: 1 });
    const groups = groupSteps([step(1, 12109, 5), step(1), step(2), step(3), step(4, 12205), step(5)]);
    expect(groups.map((g) => [g.first.id, g.first.from, g.steps.map((s) => s.planetId)])).toEqual([
      [12109, 5, [1]], [12109, 6, [1, 2, 3]], [12205, 6, [4]], [12109, 6, [5]],
    ]);
  });

  it('re-opening does not duplicate the panel', () => {
    open();
    open();
    expect(document.querySelectorAll('#fut-dashboard')).toHaveLength(1);
    closeDashboard(document);
  });

  it('every tab renders without broken values', () => {
    open();
    for (const tab of TABS) {
      goTo(tab);
      expect(shadow().querySelector('.tab[aria-pressed="true"]')?.getAttribute('data-tab')).toBe(tab);
      expect(shadow().textContent).not.toMatch(/NaN|undefined/);
    }
    goTo('summary');
    closeDashboard(document);
  });

  it('mines tab: one row per planet with game links', () => {
    open();
    goTo('mines');
    const rows = shadow().querySelectorAll('tbody tr');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.querySelector('a')?.getAttribute('href')).toContain('cp=1');
    goTo('summary');
    closeDashboard(document);
  });
});

describe('dashboard maths', () => {
  it('scrap return follows the rate and caps at 75%', () => {
    expect(scrapReturn({ 202: 10 }, 35)).toEqual({ metal: 7000, crystal: 7000, deuterium: 0 });
    expect(scrapReturn({ 202: 10 }, 90)).toEqual(scrapReturn({ 202: 10 }, 75));
  });
  it('names: learned beats built-in, lifeforms fall back to English', () => {
    expect(techName(1, 'it')).toBe('Miniera di metallo');
    expect(techName(1, 'it', { 1: 'Miniera M' })).toBe('Miniera M');
    expect(techName(12101, 'it')).toBe('Meditation Enclave');
    expect(techName(14218, 'de')).toBe('Kaelesh Discoverer Enhancement');
    expect(lfResearch(2)).toHaveLength(18);
  });
});
