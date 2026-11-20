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
    // The account's figures are one printed score line, each labelled once (no tile grid).
    expect(shadow().querySelectorAll('.kpi')).toHaveLength(0);
    expect(shadow().querySelectorAll('.facts .fact').length).toBeGreaterThanOrEqual(3);
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
    // Switching a kind off keeps it off.
    const kind = () => shadow().querySelector<HTMLButtonElement>('.seg[role="group"] button')!;
    expect(kind().getAttribute('aria-pressed')).toBe('true');
    kind().click();
    expect(kind().getAttribute('aria-pressed')).toBe('false');
    kind().click();
    expect(shadow().querySelectorAll('.move').length).toBeGreaterThan(0);
    expect(shadow().textContent).not.toMatch(/NaN|undefined|Infinity/);
    goTo('summary');
    closeDashboard(document);
  });

  it('groups consecutive steps of the same technology: same level on several planets, or successive levels on one', () => {
    const step = (planetId: number, id = 12109, from = 6) => ({ kind: 'lfBuilding' as const, id, planetId, name: `P${planetId}`, coords: '1:1:1', from, to: from + 1, cost: { metal: 1, crystal: 1, deuterium: 0, energy: 0 }, gain: { metal: 0, crystal: 1, deuterium: 0 }, days: 1 });
    const groups = groupSteps([step(1, 12109, 5), step(1), step(1, 12109, 7), step(2), step(3), step(4, 12205), step(5), step(6, 12109, 7), step(5, 12109, 8)]);
    expect(groups.map((g) => [g.first.id, g.first.from, g.steps[g.steps.length - 1]!.to, g.steps.map((s) => s.planetId)])).toEqual([
      [12109, 5, 8, [1, 1, 1]], [12109, 6, 7, [2, 3]], [12205, 6, 7, [4]], [12109, 6, 7, [5]], [12109, 7, 8, [6]], [12109, 8, 9, [5]],
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
  it('scrap return follows the rate and caps at 90%', () => {
    expect(scrapReturn({ 202: 10 }, 35)).toEqual({ metal: 7000, crystal: 7000, deuterium: 0 });
    expect(scrapReturn({ 202: 10 }, 95)).toEqual(scrapReturn({ 202: 10 }, 90));
    expect(scrapReturn({ 202: 10 }, 90)).toEqual({ metal: 18000, crystal: 18000, deuterium: 0 });
  });
  it('names: learned beats built-in, lifeforms fall back to English', () => {
    expect(techName(1, 'it')).toBe('Miniera di metallo');
    expect(techName(1, 'it', { 1: 'Miniera M' })).toBe('Miniera M');
    expect(techName(12101, 'it')).toBe('Meditation Enclave');
    expect(techName(14218, 'de')).toBe('Kaelesh Discoverer Enhancement');
    expect(lfResearch(2)).toHaveLength(18);
  });
});

describe('ships on a body follow the fleet page', () => {
  it('a send takes its ships away, the fleet page sets what is there', async () => {
    const { applyPageShips, shipsAfterSend, fleetValue } = await import('../src/engines/account');
    const snapshot = { fetchedAt: 0, researches: {}, bodies: [{ id: 7, type: 'planet', name: '', coords: '', siblingId: null, production: { metal: 0, crystal: 0, deuterium: 0 }, resources: { metal: 0, crystal: 0, deuterium: 0 }, storage: { metal: 0, crystal: 0, deuterium: 0 }, resourcesAt: 0, levels: { '1': 30, '203': 100, '213': 5, '212': 40 } }] } as never;
    const left = shipsAfterSend({ '203': 100, '213': 5, '212': 40 }, [{ id: 203, number: 100 }, { id: 213, number: 9 }]);
    expect(left).toEqual({ '203': 0, '213': 0, '212': 40 });
    expect(applyPageShips(snapshot, 7, left)).toBe(true);
    const body = (snapshot as { bodies: { levels: Record<string, number> }[] }).bodies[0]!;
    // Flying ships gone; buildings and solar satellites untouched.
    expect(fleetValue(body)).toBe(0);
    expect(body.levels['1']).toBe(30);
    expect(body.levels['212']).toBe(40);
    // Same again: nothing changes. Back home: the value returns. Unknown body: nothing.
    expect(applyPageShips(snapshot, 7, left)).toBe(false);
    expect(applyPageShips(snapshot, 7, { '203': 100 })).toBe(true);
    expect(fleetValue(body)).toBeGreaterThan(0);
    expect(applyPageShips(snapshot, 99, { '203': 1 })).toBe(false);
  });
});

describe('scrap tab', () => {
  it('quick rates set the field and the result, the one in use pressed; the body list opens on the left', async () => {
    const { readPlanetList } = await import('../src/data/planet-list');
    const { PLANET_LIST_HTML, SNAPSHOT } = await import('./fixtures');
    const { translator } = await import('../src/core/i18n');
    document.body.innerHTML = PLANET_LIST_HTML;
    const snapshot = { ...SNAPSHOT, bodies: SNAPSHOT.bodies.map((b) => ({ ...b, levels: { ...b.levels, 202: 10 } })) };
    openDashboard({ doc: document, snapshot, entries: readPlanetList(document), score: null, now: 0, locale: 'it', t: translator('it') });
    document.getElementById('fut-dashboard')!.shadowRoot!.querySelector<HTMLButtonElement>('.tab[data-tab="scrap"]')!.click();
    // The tab redraws the window: read it again.
    const root = document.getElementById('fut-dashboard')!.shadowRoot!;
    const chips = [...root.querySelectorAll<HTMLButtonElement>('.scrap-rates .rate-chip')];
    expect(chips.map((c) => c.textContent)).toEqual(['75%', '81%', '83%', '85%', '87%', '90%']);
    chips[5]!.click();
    expect(root.querySelector<HTMLInputElement>('.scrap-bar input.rate')!.value).toBe('90');
    expect(chips.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.textContent)).toEqual(['90%']);
    expect(root.querySelector('.scrap-bar .bmenu')!.classList.contains('left')).toBe(true);
    closeDashboard(document);
  });
});

describe('one page at a time', () => {
  const setup = async () => {
    const { readPlanetList } = await import('../src/data/planet-list');
    const { PLANET_LIST_HTML, SNAPSHOT } = await import('./fixtures');
    const { translator } = await import('../src/core/i18n');
    document.body.innerHTML = PLANET_LIST_HTML;
    const snapshot = { ...SNAPSHOT, bodies: SNAPSHOT.bodies.map((b) => ({ ...b, species: b.type === 'planet' ? 3 : 0, levels: { ...b.levels, 14: 10, 41: 5, 13101: 4, 13201: 3, 202: 10, 401: 20 } })) };
    openDashboard({ doc: document, snapshot, entries: readPlanetList(document), score: null, now: 0, locale: 'it', t: translator('it') });
    const root = () => document.getElementById('fut-dashboard')!.shadowRoot!;
    const go = (tab: string) => root().querySelector<HTMLButtonElement>(`.tab[data-tab="${tab}"]`)!.click();
    return { root, go };
  };

  it('Strutture: planets or moons; Forme di vita: buildings or research, switched in the title row', async () => {
    const { root, go } = await setup();
    go('facilities');
    expect(root().querySelectorAll('.table-head .seg button')).toHaveLength(2);
    expect(root().querySelectorAll('table.matrix')).toHaveLength(1);
    root().querySelector<HTMLButtonElement>('.seg button[data-scope="moon"]')!.click();
    expect(root().querySelector('.seg button[data-scope="moon"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(root().querySelectorAll('table.matrix')).toHaveLength(1);
    go('lifeforms');
    expect(root().querySelector('.seg button[data-scope="buildings"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(root().querySelectorAll('table.matrix.lf')).toHaveLength(1);
    root().querySelector<HTMLButtonElement>('.seg button[data-scope="research"]')!.click();
    expect(root().querySelector('.seg button[data-scope="research"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(root().querySelectorAll('table.matrix.lf')).toHaveLength(1);
    closeDashboard(document);
  });

  it('Rottamatore: ships and defences in two tables, one total over both', async () => {
    const { root, go } = await setup();
    go('scrap');
    const tables = root().querySelectorAll('.scrap-cols table.scrap');
    expect(tables).toHaveLength(2);
    const [ship, def] = [...root().querySelectorAll<HTMLInputElement>('.scrap-cols input.qty')];
    ship!.value = '10';
    ship!.dispatchEvent(new Event('input'));
    def!.value = '20';
    def!.dispatchEvent(new Event('input'));
    // 10 small cargo (2000 M + 2000 C each) and 20 rocket launchers (2000 M each), at the rate in the field.
    const rate = Number(root().querySelector<HTMLInputElement>('.scrap-bar input.rate')!.value);
    const sum = scrapReturn({ 202: 10, 401: 20 }, rate);
    const metal = root().querySelector('.scrap-total b.m')!.textContent!;
    expect(sum.metal).toBe(Math.floor(60000 * rate / 100));
    expect(metal).toBe(`${(sum.metal / 1000).toFixed(1).replace('.', ',')}k`);
    closeDashboard(document);
  });
});
