import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readCurrentResources, readPlanetList } from '../src/data/planet-list';
import { dataAge, renderPlanetMenu } from '../src/modules/planet-menu';
import { translator } from '../src/core/i18n';
import { PLANET_LIST_HTML, SNAPSHOT } from './fixtures';
import { DOCK_ID, renderDock } from '../src/modules/dock';
import { loadMarks } from '../src/engines/marks';

const t = translator('it');
const draw = (mode: 'side' | 'compact', onOpenSettings = vi.fn(), onSync = vi.fn(async () => true)) =>
  renderPlanetMenu({
    doc: document, entries: readPlanetList(document), snapshot: SNAPSHOT, settings: { mode, showTotals: true },
    now: 0, locale: 'it', t, onOpenSettings, onSync,
  });

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = PLANET_LIST_HTML;
});

describe('readPlanetList', () => {
  it('reads ids, coords, names and the current body', () => {
    const [a, b] = readPlanetList(document);
    expect(a).toMatchObject({ planetId: 1, moonId: 2, coords: '5:185:2', name: 'Yolen', current: 'planet' });
    expect(b).toMatchObject({ planetId: 3, moonId: null, current: null });
  });

  it('reads the resource bar from data-raw', () => {
    document.body.insertAdjacentHTML('beforeend',
      '<span id="resources_metal" data-raw="12"></span><span id="resources_crystal" data-raw="3"></span><span id="resources_deuterium" data-raw="0"></span>');
    expect(readCurrentResources(document)).toEqual({ metal: 12, crystal: 3, deuterium: 0 });
  });
});

describe('renderPlanetMenu', () => {
  it('a redraw (e.g. after adding to the plan) leaves one fleet line per planet, inside the name column', () => {
    const snapshot = { ...SNAPSHOT, bodies: SNAPSHOT.bodies.map((b) => ({ ...b, levels: { 203: 10 } })) };
    const once = () => renderPlanetMenu({ doc: document, entries: readPlanetList(document), snapshot, settings: { mode: 'side', showTotals: true, showFleet: true }, now: 0, locale: 'it', t, onSync: vi.fn(async () => true) });
    once();
    once();
    const fleets = document.querySelectorAll('#planet-1 .fut-fleet');
    expect(fleets).toHaveLength(1);
    expect(fleets[0]!.parentElement!.classList.contains('fut-name')).toBe(true);
    // Totals: each line with its symbol, the fleet included.
    expect(document.querySelectorAll('.fut-totals .fut-tico svg').length).toBe(5);
  });

  it('adds planet and moon rows on the game links themselves', () => {
    draw('side');
    const planetLink = document.querySelector('#planet-1 a.planetlink')!;
    const moonLink = document.querySelector('#planet-1 a.moonlink')!;
    expect(planetLink.querySelector('.fut-name .planet-name')?.textContent).toBe('Yolen');
    expect(planetLink.querySelectorAll('.fut-res .fut-cell')).toHaveLength(3);
    expect(moonLink.querySelectorAll('.fut-res .fut-cell')).toHaveLength(3);
    expect(moonLink.getAttribute('href')).toContain('cp=2');
    expect(document.querySelector('#planet-1 .fut-m')?.textContent).toBe('38,3M');
    expect(document.querySelector('#planet-1 .fut-m')?.classList.contains('fut-full')).toBe(true);
  });

  it('marks bodies missing from the snapshot instead of printing NaN', () => {
    draw('side');
    const cells = document.querySelectorAll('#planet-3 .fut-res span');
    expect(Array.from(cells).every((c) => c.textContent === '—')).toBe(true);
    expect(document.body.textContent).not.toMatch(/NaN|undefined/);
  });

  it('marks a construction with a dot where the game shows its wrench, nothing on idle planets', () => {
    draw('side');
    expect(document.querySelector('#planet-1 .fut-queue')).toBeNull();
    // Queues never read: the game's own icon is enough for one plain dot.
    expect(Array.from(document.querySelectorAll('#planet-3 .fut-q')).map((d) => d.className)).toEqual(['fut-q fut-q-unknown']);
  });

  it('paints storage fill behind planet numbers only, never on moons', () => {
    draw('side');
    const cell = document.querySelector<HTMLElement>('#planet-1 a.planetlink .fut-m')!;
    expect(cell.style.getPropertyValue('--fut-fill')).toMatch(/%$/);
    expect(document.querySelectorAll('#planet-1 a.moonlink .fut-has-fill')).toHaveLength(0);
  });

  it('keeps columns aligned on planets without a moon', () => {
    draw('side');
    expect(document.querySelector('#planet-3 .fut-nomoon')).not.toBeNull();
    expect(document.querySelector('#planet-1 .fut-nomoon')).toBeNull();
  });

  it('falls back to the 1x skin when the image fails, then to a plain sphere', () => {
    draw('side');
    const img = document.querySelector<HTMLImageElement>('#planet-1 img.planetPic')!;
    img.dataset.defaultSrc = 'fallback.png';
    img.dispatchEvent(new Event('error'));
    expect(img.getAttribute('src')).toBe('fallback.png');
    img.dispatchEvent(new Event('error'));
    expect(img.classList.contains('fut-noskin')).toBe(true);
  });

  it('can be redrawn without duplicating anything', () => {
    draw('side');
    draw('compact');
    expect(document.querySelectorAll('.fut-toolbar')).toHaveLength(1);
    expect(document.querySelectorAll('.fut-nomoon')).toHaveLength(1);
    expect(document.querySelectorAll('#planet-1 .fut-res')).toHaveLength(2); // planet + moon
    expect(document.querySelectorAll('.fut-name')).toHaveLength(2);
    expect(document.getElementById('planetList')?.classList.contains('fut-mode-compact')).toBe(true);
  });

  it('toolbar lines show data and open their window', () => {
    const onOpenPlanner = vi.fn();
    const onOpenDashboard = vi.fn();
    renderPlanetMenu({
      doc: document, entries: readPlanetList(document), snapshot: SNAPSHOT, settings: { mode: 'side', showTotals: true },
      now: 0, locale: 'it', t, onSync: vi.fn(async () => true),
      onOpenDashboard, onOpenPlanner, planCount: 50, planGap: 1.2e9,
    });
    const cells = Array.from(document.querySelectorAll<HTMLButtonElement>('.fut-toolbar .fut-cell'));
    expect(cells.map((c) => c.querySelector('.fut-cell-k')!.textContent)).toEqual(['Produzione', 'Piano · 50']);
    expect(cells[0]!.querySelector('.fut-cell-v')!.textContent).toMatch(/^\+.* MSU\/g$/);
    expect(cells[1]!.querySelector('.fut-cell-v')!.textContent).toBe('−1,2G');
    expect(cells[1]!.title).toContain('mancano 1,2G');
    cells[0]!.click();
    cells[1]!.click();
    expect(onOpenDashboard).toHaveBeenCalledTimes(1);
    expect(onOpenPlanner).toHaveBeenCalledTimes(1);
    // Totals: a table with a heading row and one row per resource plus MSU.
    expect(document.querySelectorAll('.fut-totals .fut-trow')).toHaveLength(5);
  });

  it('the dock under the game menu shows journal and targets and opens them', () => {
    const links = document.createElement('div');
    links.id = 'links';
    document.body.append(links);
    const onOpenJournal = vi.fn();
    const onOpenTargets = vi.fn();
    const marks = loadMarks({
      players: { 1: { flag: 'farm', name: 'A', at: 0 }, 2: { flag: 'farm', name: 'B', at: 0 }, 3: { flag: 'danger', name: 'C', at: 0 } },
      planets: { '1:2:3': { tag: 'red', planet: 'P', player: 'A', playerId: 1, statuses: [], moon: false, at: 0 } },
    });
    const days = Array.from({ length: 7 }, (_, i) => ({ start: i, count: i === 6 ? 25 : 0, net: i === 6 ? 4e7 : 0 }));
    const o = { doc: document, t, locale: 'it', journal: { today: { count: 25, net: 4e7 }, week: { count: 0, net: 0 }, days }, marks, onOpenJournal, onOpenTargets };
    renderDock(o);
    renderDock(o);
    expect(document.querySelectorAll(`#${DOCK_ID}`)).toHaveLength(1);
    const dock = links.querySelector(`#${DOCK_ID}`)!;
    // Today large, then 7 small columns (today lit), then the week and the coloured planets.
    expect(dock.querySelector('.jtoday .v')!.textContent).toBe('+40,0MMSU');
    expect(dock.querySelectorAll('.days i')).toHaveLength(7);
    expect(dock.querySelector('.days i:last-child')!.classList.contains('today')).toBe(true);
    expect([...dock.querySelectorAll('.line .v')].map((v) => v.textContent)).toEqual(['—', '1']);
    expect(dock.querySelector('.head .n')!.textContent).toBe('4');
    expect([...dock.querySelectorAll('.flag')].map((f) => f.getAttribute('aria-label'))).toEqual(['Frigo: 2', 'Pericolo: 1']);
    dock.querySelector<HTMLButtonElement>('.jtoday')!.click();
    expect(onOpenJournal).toHaveBeenCalledOnce();
    dock.querySelector<HTMLButtonElement>('.flag')!.click();
    expect(onOpenTargets).toHaveBeenLastCalledWith({ tab: 'players', flagTab: 'farm' });
    dock.querySelectorAll<HTMLButtonElement>('.head')[1]!.click();
    expect(onOpenTargets).toHaveBeenLastCalledWith();
    links.remove();
  });

  it('sync runs only from the button click', () => {
    const onSync = vi.fn(async () => true);
    draw('side', vi.fn(), onSync);
    expect(onSync).not.toHaveBeenCalled();
    document.querySelector<HTMLButtonElement>('.fut-toolbar .fut-tool-sync')!.click();
    expect(onSync).toHaveBeenCalledTimes(1);
  });

  it('the gear opens the settings window, saying whether side by side fits', () => {
    const onOpenSettings = vi.fn();
    draw('side', onOpenSettings);
    document.querySelector<HTMLButtonElement>('.fut-tool-settings')!.click();
    expect(onOpenSettings).toHaveBeenCalledWith(expect.objectContaining({ roomy: true }));
  });
});

describe('width and banner', () => {
  it('widens the column and shifts the banner only in side-by-side mode', () => {
    document.body.innerHTML = `<div id="planetbarcomponent">${PLANET_LIST_HTML}</div><div id="bannerskyscrapercomponent"></div>`;
    draw('side');
    expect(document.getElementById('planetbarcomponent')?.classList.contains('fut-wide')).toBe(true);
    expect(document.body.classList.contains('fut-banner-shift')).toBe(true);
    draw('compact');
    expect(document.getElementById('planetbarcomponent')?.classList.contains('fut-wide')).toBe(false);
    expect(document.body.classList.contains('fut-banner-shift')).toBe(false);
  });
});

describe('data age badge', () => {
  it('counts minutes, then hours and days, with OGLight colour steps', () => {
    expect(dataAge(0, 5 * 60_000)).toEqual({ text: '5', cls: 'fut-age-fresh' });
    expect(dataAge(0, 20 * 60_000)).toEqual({ text: '20', cls: 'fut-age-warm' });
    expect(dataAge(0, 45 * 60_000)).toEqual({ text: '45', cls: 'fut-age-old' });
    expect(dataAge(0, 3 * 3_600_000)).toEqual({ text: '3h', cls: 'fut-age-old' });
    expect(dataAge(0, 2 * 86_400_000)).toEqual({ text: '2d', cls: 'fut-age-old' });
  });
});

describe('when the game reloads the planet bar', () => {
  it('draws the menu again, once', async () => {
    const { watchPlanetBar } = await import('../src/modules/planet-menu');
    document.body.innerHTML = `<div id="planetbarcomponent">${PLANET_LIST_HTML}</div>`;
    const redraw = vi.fn(() => draw('side'));
    redraw();
    watchPlanetBar(document, redraw);
    expect(document.querySelector('.fut-toolbar')).not.toBeNull();
    // What reloadComponent('planetbar') does: the bar's content replaced with the game's own.
    document.getElementById('planetbarcomponent')!.innerHTML = PLANET_LIST_HTML;
    await new Promise((r) => setTimeout(r, 10));
    expect(redraw).toHaveBeenCalledTimes(2);
    expect(document.querySelectorAll('.fut-toolbar')).toHaveLength(1);
  });
});
